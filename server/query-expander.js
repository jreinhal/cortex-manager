/**
 * Query Expander - deterministic goal reformulations + keyword expansion.
 * Inspired by mercenary's HybridRAG QueryExpander (no LLM by default).
 */

const DEFAULT_CONFIG = {
  maxVariants: 4,
  cacheSize: 500,
  cacheTtlMs: 15 * 60 * 1000,
  llmExpansion: false
};

const SYNONYMS = new Map([
  ['create', ['build', 'implement', 'generate']],
  ['add', ['include', 'introduce', 'append']],
  ['update', ['modify', 'change', 'revise']],
  ['fix', ['resolve', 'repair', 'correct']],
  ['test', ['verify', 'validate', 'qa']],
  ['testing', ['validation', 'qa']],
  ['e2e', ['end to end', 'end-to-end']],
  ['ui', ['user interface']],
  ['ux', ['user experience']],
  ['agent', ['agents', 'autonomous agent']],
  ['repo', ['repository', 'repositories']],
  ['log', ['logs', 'logging']],
  ['telemetry', ['analytics', 'metrics']],
  ['settings', ['preferences', 'configuration']]
]);

const REFORMULATIONS = [
  { pattern: /^create\b/i, replacements: ['build', 'implement'] },
  { pattern: /^add\b/i, replacements: ['include', 'introduce'] },
  { pattern: /^test\b/i, replacements: ['verify', 'validate'] },
  { pattern: /^review\b/i, replacements: ['analyze', 'assess'] }
];

const cache = new Map();

function getCache(key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, maxSize) {
  if (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, timestamp: Date.now() });
}

function normalize(value) {
  return (value || '').trim();
}

function generateSynonymVariants(goal) {
  const variants = [];
  const lower = goal.toLowerCase();

  for (const [term, replacements] of SYNONYMS.entries()) {
    if (!lower.includes(term)) continue;
    const regex = new RegExp(`\\b${term}\\b`, 'ig');
    replacements.forEach((replacement) => {
      const variant = goal.replace(regex, replacement);
      if (variant && variant !== goal) variants.push(variant);
    });
  }

  return variants;
}

function generateReformulations(goal) {
  const variants = [];
  REFORMULATIONS.forEach((rule) => {
    if (!rule.pattern.test(goal)) return;
    rule.replacements.forEach((replacement) => {
      variants.push(goal.replace(rule.pattern, `${replacement}`));
    });
  });

  if (goal.endsWith('?')) {
    const trimmed = goal.replace(/\?+$/, '').trim();
    if (trimmed.toLowerCase().startsWith('how to ')) {
      const action = trimmed.substring(7);
      variants.push(`${action} guide`);
      variants.push(`steps to ${action}`);
    }
    if (trimmed.toLowerCase().startsWith('what is ')) {
      const subject = trimmed.substring(8);
      variants.push(`${subject} definition`);
      variants.push(`about ${subject}`);
    }
  }

  return variants;
}

function dedupeVariants(goal, variants, maxVariants) {
  const seen = new Set([goal.toLowerCase()]);
  const result = [];

  for (const variant of variants) {
    const normalized = variant.toLowerCase().trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(variant.trim());
    if (result.length >= maxVariants) break;
  }

  return result;
}

function expandGoalVariants(goal, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const normalized = normalize(goal);
  if (!normalized) return [];

  const cacheKey = `${normalized.toLowerCase()}|${config.maxVariants}`;
  const cached = getCache(cacheKey, config.cacheTtlMs);
  if (cached) return cached;

  const candidates = [
    ...generateSynonymVariants(normalized),
    ...generateReformulations(normalized)
  ];

  const result = dedupeVariants(normalized, candidates, config.maxVariants);
  setCache(cacheKey, result, config.cacheSize);
  return result;
}

module.exports = {
  expandGoalVariants
};
