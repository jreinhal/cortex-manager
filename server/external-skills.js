/**
 * External Skills - Provider registry + best-effort install pipeline.
 *
 * Key goals:
 * - Admin-controlled provider list (types are code-defined adapters)
 * - Parallel provider search with timeouts (best-effort via allSettled)
 * - Concurrency-limited downloads/installs
 * - Deterministic by default (no implicit updates when version unspecified)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const clawhub = require('./clawhub');
const { writeJsonAtomic } = require('./storage');

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_MAX_ZIP_BYTES = 15 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  // Executables and scripts that users might run by accident
  '.exe', '.dll', '.so', '.dylib', '.bin', '.cmd', '.bat', '.ps1', '.sh',
  // Archives nested inside archives are often used for smuggling
  '.zip', '.7z', '.rar', '.gz', '.tgz', '.bz2', '.xz',
  // Large-ish binary formats
  '.apk', '.jar', '.msi'
]);

function parseBoolean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false;
  return null;
}

function normalizeTrainingMode(value, fallback = 'blocking') {
  const text = (value || '').toString().trim().toLowerCase();
  if (text === 'off' || text === 'none' || text === 'disabled') return 'off';
  if (text === 'background' || text === 'async') return 'background';
  if (text === 'blocking' || text === 'sync') return 'blocking';
  return fallback;
}

function normalizeQueryAssistMode(value, fallback = 'fallback') {
  const text = (value || '').toString().trim().toLowerCase();
  if (text === 'off' || text === 'disabled' || text === 'none') return 'off';
  if (text === 'always') return 'always';
  if (text === 'fallback') return 'fallback';
  return fallback;
}

function sanitizeSlug(slug) {
  const value = (slug ?? '').toString().trim();
  if (!value) throw new Error('Skill slug is required');
  const normalized = value.toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new Error(`Invalid skill slug: ${slug}`);
  }
  return normalized;
}

function isPathWithin(root, target) {
  if (!root || !target) return false;
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (process.platform === 'win32') {
    const rootLower = resolvedRoot.toLowerCase();
    const targetLower = resolvedTarget.toLowerCase();
    return targetLower === rootLower || targetLower.startsWith(`${rootLower}${path.sep}`);
  }
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function listFilesRecursive(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function safeExtractZip(zipBuffer, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  const extracted = [];
  for (const entry of zip.getEntries()) {
    const rawName = (entry.entryName || '').replace(/\\\\/g, '/');
    if (!rawName) continue;

    // Block zip-slip + absolute paths.
    if (rawName.startsWith('/') || rawName.startsWith('\\\\') || rawName.includes('..')) {
      throw new Error(`Unsafe zip entry path: ${rawName}`);
    }

    if (entry.isDirectory) {
      const dirPath = path.resolve(destinationDir, rawName);
      if (!isPathWithin(destinationDir, dirPath)) {
        throw new Error(`Unsafe zip directory path: ${rawName}`);
      }
      fs.mkdirSync(dirPath, { recursive: true });
      continue;
    }

    const ext = path.extname(rawName).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      continue;
    }

    const outPath = path.resolve(destinationDir, rawName);
    if (!isPathWithin(destinationDir, outPath)) {
      throw new Error(`Unsafe zip output path: ${rawName}`);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.getData());
    extracted.push(outPath);
  }
  return extracted;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFileLock(lockPath, options, fn) {
  const timeoutMs = Number.isFinite(Number(options?.timeoutMs)) ? Number(options.timeoutMs) : 30000;
  const staleMs = Number.isFinite(Number(options?.staleMs)) ? Number(options.staleMs) : 10 * 60 * 1000;
  const pollMs = Number.isFinite(Number(options?.pollMs)) ? Number(options.pollMs) : 200;

  const startedAt = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      } finally {
        fs.closeSync(fd);
      }
      break;
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;

      try {
        const stat = fs.statSync(lockPath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > staleMs) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        // ignore
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for install lock (${path.basename(lockPath)})`);
      }
      await sleep(pollMs + Math.floor(Math.random() * pollMs));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // ignore
    }
  }
}

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetchWithTimeout(url, options);
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.length > 400 ? `${text.slice(0, 400)}...` : text;
    throw new Error(`External skills request failed (${res.status}): ${snippet || res.statusText}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`External skills returned invalid JSON (${url}): ${e.message}`);
  }
}

async function fetchZipBuffer(url, { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_ZIP_BYTES, headers = {} } = {}) {
  const res = await fetchWithTimeout(url, { timeoutMs, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`External skills download failed (${res.status}): ${text || res.statusText}`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`External skills zip too large (${contentLength} bytes, limit ${maxBytes})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > maxBytes) {
    throw new Error(`External skills zip too large (${buffer.byteLength} bytes, limit ${maxBytes})`);
  }
  return buffer;
}

function tokenizeQuery(query) {
  return (query || '')
    .toString()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function computeTokenOverlapScore(queryTokens, haystackText) {
  if (!Array.isArray(queryTokens) || queryTokens.length === 0) return 0;
  const text = (haystackText || '').toString().toLowerCase();
  if (!text) return 0;
  let hits = 0;
  for (const token of queryTokens) {
    if (token.length < 2) continue;
    if (text.includes(token)) hits += 1;
  }
  return hits / Math.max(1, queryTokens.length);
}

function extractSlugsFromGoal(goalText, providerId) {
  const text = (goalText || '').toString();
  const slugs = [];

  const safeProvider = (providerId || '').toString().replace(/[^a-z0-9._-]/gi, '');
  if (!safeProvider) return [];

  const regex = new RegExp(`${safeProvider}\\s*:\\s*([a-z0-9._-]+(?:\\s*,\\s*[a-z0-9._-]+)*)`, 'gi');
  let match;
  while ((match = regex.exec(text)) !== null) {
    const list = (match[1] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    slugs.push(...list);
  }

  return Array.from(new Set(slugs.map((s) => s.toLowerCase())));
}

function resolveProviders(config) {
  const cfg = config?.externalSkills || {};
  const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
  if (providers.length > 0) return providers;

  const legacy = config?.clawhub;
  if (legacy && typeof legacy === 'object') {
    return [
      {
        id: 'clawhub',
        type: 'clawhub_v1',
        enabled: legacy.enabled === true,
        registryBase: legacy.registryBase || clawhub.DEFAULT_REGISTRY_BASE,
        providerDirName: legacy.providerDirName || '_clawhub',
        maxSkills: legacy.maxSkills || 2,
        minScore: typeof legacy.minScore === 'number' ? legacy.minScore : 0.35,
        timeoutMs: legacy.timeoutMs || 8000,
        maxZipBytes: legacy.maxZipBytes || 15728640,
        overwrite: legacy.overwrite !== false
      }
    ];
  }

  return [];
}

async function providerSearch(provider, query, globalOptions) {
  const type = (provider?.type || '').toString().toLowerCase();
  if (type === 'clawhub_v1') {
    const registryBase = provider.registryBase || clawhub.DEFAULT_REGISTRY_BASE;
    const timeoutMs = Number.isFinite(Number(provider.timeoutMs)) ? Number(provider.timeoutMs) : 8000;
    const minScore = typeof provider.minScore === 'number' ? provider.minScore : 0.35;
    const limit = Math.max(0, Math.min(50, Number(provider.maxSkills || globalOptions.maxSkills || 2)));

    const hits = await clawhub.searchSkills(query, { registryBase, limit, minScore, timeoutMs });
    return hits.map((hit) => ({
      providerId: provider.id,
      providerType: 'clawhub_v1',
      slug: hit.slug,
      version: hit.version || null,
      score: typeof hit.score === 'number' ? hit.score : null,
      source: 'search',
      query
    }));
  }

  if (type === 'index_json_v1') {
    const indexUrl = provider.indexUrl;
    if (!indexUrl) throw new Error('indexUrl is required');

    const timeoutMs = Number.isFinite(Number(provider.timeoutMs)) ? Number(provider.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const minScore = typeof provider.minScore === 'number' ? provider.minScore : 0.35;
    const limit = Math.max(0, Math.min(50, Number(provider.maxSkills || globalOptions.maxSkills || 2)));

    const data = await fetchJson(indexUrl, { timeoutMs });
    const entries = Array.isArray(data) ? data : (Array.isArray(data?.skills) ? data.skills : []);
    const queryTokens = tokenizeQuery(query);

    const scored = entries
      .filter((entry) => entry && typeof entry.slug === 'string')
      .map((entry) => {
        const text = [
          entry.slug,
          entry.name,
          entry.description,
          Array.isArray(entry.tags) ? entry.tags.join(' ') : '',
          Array.isArray(entry.keywords) ? entry.keywords.join(' ') : ''
        ].filter(Boolean).join(' ');
        const score = computeTokenOverlapScore(queryTokens, text);
        return {
          providerId: provider.id,
          providerType: 'index_json_v1',
          slug: entry.slug,
          version: entry.version || null,
          score,
          source: 'search',
          query,
          _downloadUrl: entry.downloadUrl || entry.url || null,
          _sha256: entry.sha256 || null
        };
      })
      .filter((entry) => entry.score >= minScore)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    return scored;
  }

  throw new Error(`Unsupported provider type: ${provider?.type}`);
}

async function providerInstall(provider, candidate, installOptions) {
  const type = (provider?.type || '').toString().toLowerCase();

  if (type === 'clawhub_v1') {
    const registryBase = provider.registryBase || clawhub.DEFAULT_REGISTRY_BASE;
    const timeoutMs = Number.isFinite(Number(provider.timeoutMs)) ? Number(provider.timeoutMs) : 8000;
    const maxZipBytes = Number.isFinite(Number(provider.maxZipBytes)) ? Number(provider.maxZipBytes) : DEFAULT_MAX_ZIP_BYTES;
    const overwrite = provider.overwrite !== false;
    const providerDirName = provider.providerDirName || '_clawhub';

    return clawhub.installSkill(candidate.slug, {
      reposRoot: installOptions.reposRoot,
      providerDirName,
      providerId: provider.id || 'clawhub',
      version: candidate.version || null,
      registryBase,
      timeoutMs,
      maxZipBytes,
      overwrite
    });
  }

  if (type === 'index_json_v1') {
    const reposRoot = installOptions.reposRoot;
    const providerDirName = provider.providerDirName || `_external/${provider.id || 'index'}`;
    const timeoutMs = Number.isFinite(Number(provider.timeoutMs)) ? Number(provider.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const maxZipBytes = Number.isFinite(Number(provider.maxZipBytes)) ? Number(provider.maxZipBytes) : DEFAULT_MAX_ZIP_BYTES;
    const overwrite = provider.overwrite !== false;

    const safeSlug = sanitizeSlug(candidate.slug);
    const skillsRoot = path.join(reposRoot, 'skills');
    const baseDir = path.join(skillsRoot, providerDirName);
    if (!isPathWithin(skillsRoot, baseDir)) {
      throw new Error('Refusing to install outside skills directory');
    }
    fs.mkdirSync(baseDir, { recursive: true });

    const destDir = path.join(baseDir, safeSlug);
    if (!isPathWithin(baseDir, destDir)) {
      throw new Error('Refusing to install outside provider directory');
    }

    const lockPath = path.join(baseDir, `.${safeSlug}.install.lock`);
    return withFileLock(lockPath, { timeoutMs: Math.max(2000, timeoutMs) }, async () => {
      const metaPath = path.join(destDir, '_meta.json');
      let existing = null;
      if (fs.existsSync(metaPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
        } catch {
          existing = null;
        }
      }

      // Deterministic: if version unspecified, treat existing as pinned.
      if (existing && (!candidate.version || existing.version === candidate.version)) {
        return {
          installed: false,
          alreadyInstalled: true,
          slug: safeSlug,
          version: existing.version || null,
          dir: destDir
        };
      }

      const downloadUrl = candidate._downloadUrl;
      if (!downloadUrl) {
        throw new Error('index_json_v1 entry missing downloadUrl');
      }

      const zipBuffer = await fetchZipBuffer(downloadUrl, { timeoutMs, maxBytes: maxZipBytes });
      if (candidate._sha256) {
        const digest = crypto.createHash('sha256').update(zipBuffer).digest('hex');
        if (digest.toLowerCase() !== String(candidate._sha256).toLowerCase()) {
          throw new Error('index_json_v1 sha256 mismatch');
        }
      }

      const stagingDir = path.join(baseDir, `.${safeSlug}.staging-${Date.now()}`);
      fs.mkdirSync(stagingDir, { recursive: true });

      try {
        safeExtractZip(zipBuffer, stagingDir);
        const skillFile = path.join(stagingDir, 'SKILL.md');
        if (!fs.existsSync(skillFile)) {
          throw new Error('Downloaded bundle did not contain SKILL.md');
        }

        const meta = {
          providerId: (provider.id || 'index').toString(),
          providerType: 'index_json_v1',
          slug: safeSlug,
          version: candidate.version || null,
          indexUrl: provider.indexUrl || null,
          downloadUrl,
          installedAt: new Date().toISOString()
        };
        try {
          writeJsonAtomic(path.join(stagingDir, '_meta.json'), meta);
        } catch {
          // ignore
        }

        if (overwrite && fs.existsSync(destDir)) {
          fs.rmSync(destDir, { recursive: true, force: true });
        }

        fs.renameSync(stagingDir, destDir);

        return {
          installed: true,
          alreadyInstalled: false,
          slug: safeSlug,
          version: candidate.version || null,
          dir: destDir,
          files: listFilesRecursive(destDir).map((filePath) => path.relative(destDir, filePath))
        };
      } catch (e) {
        try {
          if (fs.existsSync(stagingDir)) {
            fs.rmSync(stagingDir, { recursive: true, force: true });
          }
        } catch {}
        throw e;
      }
    });
  }

  throw new Error(`Unsupported provider type: ${provider?.type}`);
}

function mapWithConcurrency(items, concurrency, handler) {
  const list = Array.isArray(items) ? items : [];
  const cap = Math.max(1, Number(concurrency) || 1);
  const results = new Array(list.length);

  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve) => {
    const pump = () => {
      while (active < cap && nextIndex < list.length) {
        const current = nextIndex;
        nextIndex += 1;
        active += 1;
        Promise.resolve()
          .then(() => handler(list[current], current))
          .then((value) => {
            results[current] = { status: 'fulfilled', value };
          })
          .catch((reason) => {
            results[current] = { status: 'rejected', reason };
          })
          .finally(() => {
            active -= 1;
            if (nextIndex >= list.length && active === 0) {
              resolve(results);
              return;
            }
            pump();
          });
      }
    };

    if (list.length === 0) {
      resolve([]);
      return;
    }
    pump();
  });
}

async function callQueryAssist({ goal, analysis, llmConfig, queryAssist }) {
  const mode = normalizeQueryAssistMode(queryAssist?.mode, 'fallback');
  if (mode === 'off') return [];
  if (llmConfig?.enabled !== true) return [];

  const maxQueries = Math.max(1, Math.min(5, Number(queryAssist?.maxQueries || 3)));
  const timeoutMs = Math.max(1000, Number(queryAssist?.timeoutMs || 4000));

  const messages = [
    {
      role: 'system',
      content: [
        'You generate short search queries to find relevant software/agent skills in a registry.',
        `Return strict JSON: {"queries":["..."]} with 1-${maxQueries} items.`,
        'Rules:',
        '- Queries only (no URLs).',
        '- Keep each query <= 80 chars.',
        '- Prefer concrete keywords, frameworks, tools, and task nouns.'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        goal,
        intent: analysis?.intent?.primary || null,
        keywords: analysis?.expandedKeywords?.slice(0, 20) || analysis?.keywords?.slice(0, 12) || []
      })
    }
  ];

  const provider = (llmConfig?.provider || 'openai-compatible').toString().toLowerCase();
  const endpoint = llmConfig?.endpoint;
  if (!endpoint) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let payload;
    let target = endpoint;
    if (provider === 'ollama' || /\/api\/chat/i.test(endpoint)) {
      target = endpoint || 'http://localhost:11434/api/chat';
      payload = {
        model: llmConfig.model,
        messages,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 200
        }
      };
    } else {
      payload = {
        model: llmConfig.model,
        messages,
        temperature: 0.2,
        max_tokens: 200
      };
    }

    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);

    const content = provider === 'ollama'
      ? (data?.message?.content || data?.response || '')
      : (data?.choices?.[0]?.message?.content || '');

    if (!content) return [];
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return [];
    const snippet = content.slice(start, end + 1);
    const parsed = JSON.parse(snippet);
    const queries = Array.isArray(parsed?.queries) ? parsed.queries : [];
    return queries
      .map((q) => (q ?? '').toString().trim())
      .filter(Boolean)
      .slice(0, maxQueries);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function pickCandidates({ explicitCandidates, searchCandidates, maxSkills }) {
  const selected = [];
  const seen = new Set();
  const perProviderCount = new Map();
  const globalCap = Math.max(0, Number(maxSkills) || 0);

  const push = (cand) => {
    const key = `${cand.providerId}:${cand.slug}`;
    if (seen.has(key)) return false;
    const current = perProviderCount.get(cand.providerId) || 0;
    const limit = Math.max(0, Number(cand.providerMaxSkills || 0));
    if (limit > 0 && current >= limit) return false;
    if (globalCap > 0 && selected.length >= globalCap) return false;

    seen.add(key);
    perProviderCount.set(cand.providerId, current + 1);
    selected.push(cand);
    return true;
  };

  (explicitCandidates || []).forEach((cand) => push(cand));

  const sortedSearch = (searchCandidates || [])
    .slice()
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  sortedSearch.forEach((cand) => push(cand));

  return selected;
}

async function pullExternalSkills({ goal, analysis, config, reposRoot, workspaceId, request = {} } = {}) {
  const cfg = config?.externalSkills || {};
  const providers = resolveProviders(config).filter((p) => p && typeof p === 'object');
  const enabledProviders = providers.filter((p) => p.enabled === true);

  const onlineRequested = request.online === true
    ? true
    : (request.online === false ? false : null);

  const globalEnabled = cfg.enabled === true;
  const allowRemote = cfg.allowRemote === true;
  const mode = (cfg.mode || 'off').toString().toLowerCase();
  const installConcurrency = Math.max(1, Number(cfg.installConcurrency || 2));
  const maxSkills = Math.max(0, Math.min(20, Number(cfg.maxSkills || 4)));

  const trainingMode = normalizeTrainingMode(
    request.trainingMode || cfg.training?.mode || 'blocking',
    'blocking'
  );

  const meta = {
    enabled: globalEnabled,
    allowRemote,
    mode,
    requestedOnline: onlineRequested,
    used: false,
    providers: enabledProviders.map((p) => ({ id: p.id, type: p.type })),
    attemptedProviders: [],
    selected: [],
    installed: [],
    query: null,
    queryAssist: {
      mode: normalizeQueryAssistMode(cfg.queryAssist?.mode, 'fallback'),
      used: false,
      queries: []
    },
    training: {
      mode: trainingMode
    },
    timings: {
      searchMs: 0,
      installMs: 0
    },
    skippedReason: null,
    error: null
  };

  // Gate: per-spawn toggle must be on OR feature configured to run (legacy behavior).
  const shouldRun = onlineRequested === true || (onlineRequested === null && mode !== 'off');
  if (!globalEnabled || !shouldRun) {
    meta.skippedReason = 'disabled';
    return meta;
  }

  if (!allowRemote) {
    const devMode = process.env.CORTEX_DEV_MODE === '1' || process.env.NODE_ENV === 'development';
    if (!devMode) {
      meta.skippedReason = 'remote_not_allowed';
      return meta;
    }
  }

  if (!reposRoot) {
    meta.skippedReason = 'missing_repos_root';
    return meta;
  }

  if (enabledProviders.length === 0) {
    meta.skippedReason = 'no_enabled_providers';
    return meta;
  }

  let searchStart = 0;
  let installStart = 0;
  try {
    searchStart = Date.now();

    // 1) Explicit slugs.
    const explicitCandidates = [];
    for (const provider of enabledProviders) {
      const slugs = extractSlugsFromGoal(goal, provider.id);
      const providerMax = Math.max(0, Number(provider.maxSkills || 0));
      slugs.slice(0, providerMax || slugs.length).forEach((slug) => {
        explicitCandidates.push({
          providerId: provider.id,
          providerType: provider.type,
          providerMaxSkills: providerMax || null,
          slug,
          version: null,
          score: null,
          source: 'explicit',
          query: null
        });
      });
    }

    if (mode === 'explicit' && explicitCandidates.length === 0) {
      meta.skippedReason = 'no_explicit_slugs';
      return meta;
    }

    // 2) Auto search in parallel.
    let searchCandidates = [];
    if (mode === 'auto' && explicitCandidates.length === 0 && maxSkills > 0) {
      const keywordQuery = (analysis?.expandedKeywords && analysis.expandedKeywords.length > 0)
        ? analysis.expandedKeywords.slice(0, 16).join(' ')
        : goal;
      meta.query = keywordQuery;

      meta.attemptedProviders = enabledProviders.map((p) => p.id);
      const settled = await Promise.allSettled(
        enabledProviders.map((provider) => providerSearch(provider, keywordQuery, { maxSkills }))
      );
      settled.forEach((result, idx) => {
        const provider = enabledProviders[idx];
        if (result.status === 'fulfilled') {
          const providerMax = Math.max(0, Number(provider.maxSkills || 0));
          const enriched = (result.value || []).map((cand) => ({
            ...cand,
            providerMaxSkills: providerMax || null
          }));
          searchCandidates.push(...enriched);
        }
      });

      const assistMode = normalizeQueryAssistMode(cfg.queryAssist?.mode, 'fallback');
      const needsFallback = assistMode === 'always' || (assistMode === 'fallback' && searchCandidates.length < Math.min(maxSkills, 2));
      if (needsFallback) {
        const llmQueries = await callQueryAssist({
          goal,
          analysis,
          llmConfig: config?.llm || {},
          queryAssist: cfg.queryAssist || {}
        });
        if (llmQueries.length > 0) {
          meta.queryAssist.used = true;
          meta.queryAssist.queries = llmQueries;

          const assistSettled = await Promise.allSettled(
            enabledProviders.flatMap((provider) => llmQueries.map((query) => providerSearch(provider, query, { maxSkills })))
          );

          let pointer = 0;
          for (const provider of enabledProviders) {
            const providerMax = Math.max(0, Number(provider.maxSkills || 0));
            for (const _query of llmQueries) {
              const result = assistSettled[pointer];
              pointer += 1;
              if (result?.status === 'fulfilled') {
                const enriched = (result.value || []).map((cand) => ({
                  ...cand,
                  providerMaxSkills: providerMax || null
                }));
                searchCandidates.push(...enriched);
              }
            }
          }
        }
      }
    }

    const selected = pickCandidates({
      explicitCandidates,
      searchCandidates,
      maxSkills
    });
    meta.selected = selected.map((cand) => ({
      providerId: cand.providerId,
      providerType: cand.providerType,
      slug: cand.slug,
      version: cand.version || null,
      source: cand.source,
      score: cand.score,
      query: cand.query || null
    }));

    if (selected.length === 0) {
      meta.timings.searchMs = Math.max(0, Date.now() - searchStart);
      meta.skippedReason = 'no_candidates';
      return meta;
    }

    meta.timings.searchMs = Math.max(0, Date.now() - searchStart);
    installStart = Date.now();
    const installs = await mapWithConcurrency(selected, installConcurrency, async (candidate) => {
      const provider = enabledProviders.find((p) => p.id === candidate.providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${candidate.providerId}`);
      }
      const result = await providerInstall(provider, candidate, { reposRoot, workspaceId });
      return { candidate, result };
    });

    for (const item of installs) {
      if (item.status === 'fulfilled') {
        const { candidate, result } = item.value;
        meta.installed.push({
          providerId: candidate.providerId,
          providerType: candidate.providerType,
          slug: candidate.slug,
          version: result?.version || candidate.version || null,
          installed: result?.installed === true,
          alreadyInstalled: result?.alreadyInstalled === true,
          source: candidate.source,
          score: candidate.score
        });
      } else {
        const reason = item.reason;
        meta.installed.push({
          providerId: null,
          providerType: null,
          slug: null,
          installed: false,
          alreadyInstalled: false,
          error: reason?.message || String(reason)
        });
      }
    }

    meta.used = meta.installed.some((item) => item.installed || item.alreadyInstalled);
    meta.timings.installMs = Math.max(0, Date.now() - installStart);
    return meta;
  } catch (e) {
    if (!meta.timings.searchMs) {
      meta.timings.searchMs = Math.max(0, Date.now() - (typeof searchStart === 'number' ? searchStart : Date.now()));
    }
    if (typeof installStart === 'number' && installStart > 0 && !meta.timings.installMs) {
      meta.timings.installMs = Math.max(0, Date.now() - installStart);
    }
    meta.error = e?.message || String(e);
    return meta;
  }
}

function listInstalledExternalSkills(reposRoot) {
  if (!reposRoot) return [];
  const skillsRoot = path.join(reposRoot, 'skills');
  if (!fs.existsSync(skillsRoot)) return [];

  const results = [];
  const stack = [skillsRoot];
  const ignore = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', '_system']);
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ignore.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const metaPath = path.join(full, '_meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
            results.push({
              dir: full,
              relativeDir: path.relative(reposRoot, full).replace(/\\/g, '/'),
              ...meta
            });
          } catch {
            results.push({
              dir: full,
              relativeDir: path.relative(reposRoot, full).replace(/\\/g, '/'),
              providerId: null,
              providerType: null,
              slug: entry.name,
              version: null,
              error: 'Invalid _meta.json'
            });
          }
          continue;
        }
        stack.push(full);
      }
    }
  }

  return results.sort((a, b) => {
    const at = Date.parse(a.installedAt || '') || 0;
    const bt = Date.parse(b.installedAt || '') || 0;
    return bt - at;
  });
}

async function scanForUpdates({ reposRoot, config }) {
  const installed = listInstalledExternalSkills(reposRoot);
  const providers = resolveProviders(config);
  const providerById = new Map(providers.map((p) => [p.id, p]));

  const allowRemote = config?.externalSkills?.allowRemote === true;
  if (!allowRemote) {
    const devMode = process.env.CORTEX_DEV_MODE === '1' || process.env.NODE_ENV === 'development';
    if (!devMode) {
      return { error: 'Remote external skills are disabled', installed, updates: [] };
    }
  }

  const checks = installed.map((item) => ({
    providerId: item.providerId,
    providerType: item.providerType,
    slug: item.slug,
    installedVersion: item.version || null
  })).filter((item) => item.providerId && item.providerType && item.slug);

  const settled = await mapWithConcurrency(checks, 4, async (check) => {
    const provider = providerById.get(check.providerId);
    if (!provider) {
      return { ...check, status: 'unknown_provider', latestVersion: null, updateAvailable: false };
    }
    const type = (provider.type || '').toString().toLowerCase();

    if (type === 'clawhub_v1') {
      const registryBase = provider.registryBase || clawhub.DEFAULT_REGISTRY_BASE;
      const timeoutMs = Number.isFinite(Number(provider.timeoutMs)) ? Number(provider.timeoutMs) : 8000;
      const data = await clawhub.getSkill(check.slug, { registryBase, timeoutMs });
      const latestVersion = data?.latestVersion?.version || data?.skill?.tags?.latest || null;
      const updateAvailable = Boolean(latestVersion && check.installedVersion && latestVersion !== check.installedVersion);
      return { ...check, status: 'ok', latestVersion, updateAvailable };
    }

    if (type === 'index_json_v1') {
      const indexUrl = provider.indexUrl;
      if (!indexUrl) return { ...check, status: 'error', error: 'Missing indexUrl', latestVersion: null, updateAvailable: false };
      const timeoutMs = Number.isFinite(Number(provider.timeoutMs)) ? Number(provider.timeoutMs) : DEFAULT_TIMEOUT_MS;
      const data = await fetchJson(indexUrl, { timeoutMs });
      const entries = Array.isArray(data) ? data : (Array.isArray(data?.skills) ? data.skills : []);
      const match = entries.find((e) => e && typeof e.slug === 'string' && e.slug.toLowerCase() === String(check.slug).toLowerCase());
      const latestVersion = match?.version || null;
      const updateAvailable = Boolean(latestVersion && check.installedVersion && latestVersion !== check.installedVersion);
      return { ...check, status: 'ok', latestVersion, updateAvailable };
    }

    return { ...check, status: 'unsupported_type', latestVersion: null, updateAvailable: false };
  });

  const updates = settled.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value;
    return { ...checks[idx], status: 'error', error: result.reason?.message || String(result.reason), latestVersion: null, updateAvailable: false };
  });

  return {
    installed,
    updates: updates.filter((u) => u.status === 'ok')
  };
}

module.exports = {
  parseBoolean,
  normalizeTrainingMode,
  pullExternalSkills,
  listInstalledExternalSkills,
  scanForUpdates
};
