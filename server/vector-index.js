/**
 * Vector Index - lightweight local semantic search with hashed TF-IDF or embeddings.
 */

const fs = require('fs');
const path = require('path');
const { readJsonFile, writeJsonAtomic } = require('./storage');
const config = require('./config');
const { embedTexts } = require('./embeddings');

const VECTOR_DIM = 512;
const INDEX_EXTENSIONS = ['.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.js', '.ts', '.py'];
const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'have', 'from', 'your', 'will', 'about',
  'into', 'there', 'their', 'when', 'where', 'what', 'which', 'who', 'why', 'how',
  'for', 'not', 'you', 'are', 'was', 'were', 'has', 'had', 'its', 'let', 'but',
  'can', 'could', 'should', 'would', 'using', 'use', 'used', 'all', 'any', 'each'
]);

const cachedIndex = new Map();
const queryEmbeddingCache = new Map();

function resolveMode(vectorConfig) {
  return vectorConfig?.mode === 'embedding' ? 'embedding' : 'hash';
}

function getIndexPath({ workspaceId = null, mode = 'hash' } = {}) {
  const suffix = workspaceId ? `_${workspaceId}` : '';
  const modeSuffix = mode === 'embedding' ? '_embeddings' : '';
  return path.join(__dirname, '..', `vector_index${modeSuffix}${suffix}.json`);
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token && token.length > 2 && !STOP_WORDS.has(token));
}

function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) % VECTOR_DIM;
  }
  return hash;
}

function chunkText(text, chunkSize, overlap) {
  const chunks = [];
  if (!text) return chunks;
  const size = Math.max(200, chunkSize || 800);
  const step = Math.max(50, size - (overlap || 100));
  for (let start = 0; start < text.length; start += step) {
    const chunk = text.slice(start, start + size);
    if (chunk.trim().length > 50) chunks.push(chunk);
  }
  return chunks;
}

function walkFiles(dir, fileList = []) {
  const IGNORE = ['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', '_system'];
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(entry => {
    if (IGNORE.includes(entry.name) || entry.name.startsWith('.')) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, fileList);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (INDEX_EXTENSIONS.includes(ext)) {
        fileList.push(full);
      }
    }
  });
  return fileList;
}

function buildDocuments({ reposRoot, vectorConfig }) {
  const categories = ['knowledge', 'skills', 'tools', 'agents'];
  const maxFiles = vectorConfig.maxFiles || 2000;
  const maxCharsPerFile = vectorConfig.maxCharsPerFile || 20000;
  const chunkSize = vectorConfig.chunkSize || 900;
  const chunkOverlap = vectorConfig.chunkOverlap || 120;

  const documents = [];
  let fileCount = 0;

  categories.forEach((category) => {
    const categoryPath = path.join(reposRoot, category);
    if (!fs.existsSync(categoryPath)) return;
    const files = walkFiles(categoryPath, []);
    files.forEach((filePath) => {
      if (fileCount >= maxFiles) return;
      fileCount += 1;
      let content = '';
      try {
        content = fs.readFileSync(filePath, 'utf8').slice(0, maxCharsPerFile);
      } catch {
        return;
      }

      const chunks = chunkText(content, chunkSize, chunkOverlap);
      const relPath = path.relative(reposRoot, filePath);
      chunks.forEach((chunk, idx) => {
        documents.push({
          id: `doc-${documents.length + 1}`,
          filePath,
          relativePath: relPath,
          category,
          chunkId: idx,
          snippet: chunk.slice(0, 280),
          text: chunk
        });
      });
    });
  });

  return documents;
}

function buildHashIndex({ reposRoot, vectorConfig }) {
  const documents = buildDocuments({ reposRoot, vectorConfig });
  const df = Array(VECTOR_DIM).fill(0);

  documents.forEach((doc) => {
    const tokens = tokenize(doc.text);
    if (tokens.length === 0) return;
    const bucketCounts = new Map();
    const seenBuckets = new Set();
    tokens.forEach((token) => {
      const bucket = hashToken(token);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
      seenBuckets.add(bucket);
    });
    doc.buckets = Array.from(bucketCounts.entries());
    seenBuckets.forEach((bucket) => {
      df[bucket] += 1;
    });
  });

  const docCount = documents.length;
  const idf = df.map((count) => Math.log((1 + docCount) / (1 + count)) + 1);

  const enriched = documents.map((doc) => {
    const vector = Array(VECTOR_DIM).fill(0);
    (doc.buckets || []).forEach(([bucket, count]) => {
      vector[bucket] = count * idf[bucket];
    });
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return {
      ...doc,
      vector,
      norm
    };
  });

  return {
    version: 1,
    mode: 'hash',
    builtAt: new Date().toISOString(),
    config: {
      ...vectorConfig,
      vectorDim: VECTOR_DIM
    },
    docCount,
    documents: enriched,
    idf
  };
}

async function buildEmbeddingIndex({ reposRoot, vectorConfig }) {
  const documents = buildDocuments({ reposRoot, vectorConfig });
  const batchSize = vectorConfig.embedding?.batchSize || 16;
  const allEmbeddings = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const embeddings = await embedTexts(batch.map((doc) => doc.text), {
      endpoint: vectorConfig.embedding?.endpoint,
      model: vectorConfig.embedding?.model,
      embedding: vectorConfig.embedding
    });
    embeddings.forEach((vector) => {
      allEmbeddings.push(vector);
    });
  }

  const enriched = documents.map((doc, idx) => {
    const vector = allEmbeddings[idx] || [];
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return {
      ...doc,
      vector,
      norm
    };
  });

  const vectorDim = enriched[0]?.vector?.length || vectorConfig.embedding?.dimensions || 0;

  return {
    version: 2,
    mode: 'embedding',
    builtAt: new Date().toISOString(),
    config: {
      ...vectorConfig,
      vectorDim
    },
    docCount: enriched.length,
    documents: enriched
  };
}

function saveIndex(index, options = {}) {
  const indexPath = getIndexPath(options);
  writeJsonAtomic(indexPath, index);
  cachedIndex.set(indexPath, index);
  return index;
}

function loadIndex(options = {}) {
  const indexPath = getIndexPath(options);
  if (cachedIndex.has(indexPath)) return cachedIndex.get(indexPath);
  if (!fs.existsSync(indexPath)) return null;
  const data = readJsonFile(indexPath, null);
  cachedIndex.set(indexPath, data);
  return data;
}

async function rebuildIndex({ workspaceId = null, reposRoot = null } = {}) {
  const cfg = config.getConfig().vectorIndex || {};
  if (!cfg?.enabled) {
    return { enabled: false, message: 'Vector index disabled' };
  }
  const mode = resolveMode(cfg);
  const root = reposRoot || config.getConfig().reposRoot;

  if (mode === 'embedding') {
    try {
      const index = await buildEmbeddingIndex({ reposRoot: root, vectorConfig: cfg });
      saveIndex(index, { workspaceId, mode });
      return {
        enabled: true,
        mode,
        builtAt: index.builtAt,
        docCount: index.docCount,
        vectorDim: index.config.vectorDim
      };
    } catch (error) {
      const fallback = buildHashIndex({ reposRoot: root, vectorConfig: cfg });
      saveIndex(fallback, { workspaceId, mode: 'hash' });
      return {
        enabled: true,
        mode: 'hash',
        degraded: true,
        error: error.message,
        builtAt: fallback.builtAt,
        docCount: fallback.docCount,
        vectorDim: fallback.config.vectorDim
      };
    }
  }

  const index = buildHashIndex({ reposRoot: root, vectorConfig: cfg });
  saveIndex(index, { workspaceId, mode });
  return {
    enabled: true,
    mode,
    builtAt: index.builtAt,
    docCount: index.docCount,
    vectorDim: index.config.vectorDim
  };
}

async function ensureIndex({ workspaceId = null, reposRoot = null } = {}) {
  const cfg = config.getConfig().vectorIndex || {};
  const mode = resolveMode(cfg);
  let index = loadIndex({ workspaceId, mode });
  if (!index && cfg.autoRebuild) {
    if (mode === 'embedding') {
      const summary = await rebuildIndex({ workspaceId, reposRoot });
      index = loadIndex({ workspaceId, mode: summary.mode || mode });
    } else {
      const built = buildHashIndex({ reposRoot: reposRoot || config.getConfig().reposRoot, vectorConfig: cfg });
      saveIndex(built, { workspaceId, mode });
      index = built;
    }
  }
  return index;
}

async function searchHash(query, index, options = {}) {
  const minScore = options.minScore ?? (config.getConfig().vectorIndex?.minScore ?? 0);
  const topK = options.topK || 20;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const queryVector = Array(VECTOR_DIM).fill(0);
  const queryBuckets = new Map();
  tokens.forEach((token) => {
    const bucket = hashToken(token);
    queryBuckets.set(bucket, (queryBuckets.get(bucket) || 0) + 1);
  });
  queryBuckets.forEach((count, bucket) => {
    queryVector[bucket] = count * (index.idf?.[bucket] || 0);
  });
  const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0)) || 1;

  const results = index.documents.map((doc) => {
    let dot = 0;
    for (let i = 0; i < VECTOR_DIM; i += 1) {
      dot += queryVector[i] * doc.vector[i];
    }
    const score = dot / (queryNorm * (doc.norm || 1));
    return {
      filePath: doc.filePath,
      relativePath: doc.relativePath,
      category: doc.category,
      snippet: doc.snippet,
      score
    };
  });

  return results
    .filter((r) => Number.isFinite(r.score) && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function searchEmbedding(query, index, options = {}) {
  const minScore = options.minScore ?? (config.getConfig().vectorIndex?.minScore ?? 0);
  const topK = options.topK || 20;
  const cacheKey = `${options.workspaceId || 'default'}:${index.config?.embedding?.model || ''}:${query}`;
  let queryVector = queryEmbeddingCache.get(cacheKey);
  if (!queryVector) {
    const [embedded] = await embedTexts([query], {
      endpoint: index.config?.embedding?.endpoint,
      model: index.config?.embedding?.model,
      embedding: index.config?.embedding
    });
    queryVector = embedded || [];
    queryEmbeddingCache.set(cacheKey, queryVector);
  }
  const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0)) || 1;

  const results = index.documents.map((doc) => {
    let dot = 0;
    for (let i = 0; i < queryVector.length; i += 1) {
      dot += queryVector[i] * doc.vector[i];
    }
    const score = dot / (queryNorm * (doc.norm || 1));
    return {
      filePath: doc.filePath,
      relativePath: doc.relativePath,
      category: doc.category,
      snippet: doc.snippet,
      score
    };
  });

  return results
    .filter((r) => Number.isFinite(r.score) && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function search(query, options = {}) {
  const cfg = config.getConfig().vectorIndex || {};
  if (!cfg?.enabled || !query) return [];
  const mode = resolveMode(cfg);
  const index = await ensureIndex({ workspaceId: options.workspaceId, reposRoot: options.reposRoot });
  if (!index) return [];

  if (mode === 'embedding' && index.mode === 'embedding') {
    return searchEmbedding(query, index, options);
  }
  return searchHash(query, index, options);
}

function getStatus({ workspaceId = null } = {}) {
  const cfg = config.getConfig().vectorIndex || {};
  const mode = resolveMode(cfg);
  const index = loadIndex({ workspaceId, mode });
  return {
    enabled: cfg.enabled === true,
    autoRebuild: cfg.autoRebuild === true,
    mode,
    docCount: index?.docCount || 0,
    builtAt: index?.builtAt || null,
    vectorDim: index?.config?.vectorDim || (mode === 'embedding' ? cfg.embedding?.dimensions : VECTOR_DIM)
  };
}

module.exports = {
  search,
  rebuildIndex,
  getStatus
};
