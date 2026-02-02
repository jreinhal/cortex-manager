/**
 * Late Interaction Reranker - lightweight ColBERT-style max-sim approximation.
 * Operates on top-K per category to avoid heavy compute.
 */

const stringSimilarity = require('string-similarity');

const DEFAULT_CONFIG = {
  enabled: true,
  topK: 8,
  weight: 0.35,
  minScore: 0.15
};

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'best', 'practice', 'practices', 'guide', 'guides', 'overview', 'intro',
  'reference', 'references', 'pattern', 'patterns', 'example', 'examples',
  'sample', 'samples', 'docs', 'documentation', 'readme', 'skill', 'skills',
  'knowledge', 'tool', 'tools', 'resource', 'resources', 'repo', 'repos',
  'repository', 'repositories', 'project', 'projects', 'application',
  'applications', 'using'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function maxSimScore(queryTokens, docTokens) {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  let total = 0;
  queryTokens.forEach((q) => {
    let best = 0;
    if (docTokens.includes(q)) {
      best = 1;
    } else {
      for (const d of docTokens) {
        if (d.length < 3) continue;
        const sim = stringSimilarity.compareTwoStrings(q, d);
        if (sim > best) best = sim;
        if (best >= 0.92) break;
      }
    }
    total += best;
  });
  return total / queryTokens.length;
}

function rerankCategory(resources, goalText, config) {
  if (!resources || resources.length < 2) return resources;

  const queryTokens = tokenize(goalText);
  if (queryTokens.length === 0) return resources;

  const top = resources.slice(0, config.topK);
  const rest = resources.slice(config.topK);

  const reranked = top.map((item) => {
    const docText = `${item.fileName || ''} ${item.relativePath || ''} ${item.summary || ''}`;
    const docTokens = tokenize(docText);
    const lateScore = maxSimScore(queryTokens, docTokens);
    const blended = (1 - config.weight) * item.score + config.weight * lateScore;
    return {
      ...item,
      lateScore,
      score: Math.max(item.score, blended)
    };
  });

  reranked.sort((a, b) => {
    if (a.isInstruction !== b.isInstruction) return a.isInstruction ? -1 : 1;
    return b.score - a.score;
  });

  return reranked.concat(rest);
}

function rerankResources({ goalText, results, config = {} }) {
  const merged = { ...DEFAULT_CONFIG, ...(config || {}) };
  if (!merged.enabled) {
    return { results, used: false };
  }

  const categories = ['knowledge', 'skills', 'tools'];
  const next = { ...results };
  let used = false;

  categories.forEach((cat) => {
    const list = results[cat] || [];
    if (list.length === 0) return;
    next[cat] = rerankCategory(list, goalText, merged);
    used = used || list.length >= 2;
  });

  return { results: next, used };
}

module.exports = {
  rerankResources,
  DEFAULT_CONFIG
};
