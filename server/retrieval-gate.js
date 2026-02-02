/**
 * Retrieval Gate - decide when to skip retrieval to reduce latency.
 * Heuristic-only (deterministic) with explicit user overrides.
 */

const DEFAULT_RETRIEVAL_GATE = {
  enabled: true,
  minKeywordCount: 2,
  minGoalTokens: 4,
  skipIntents: [],
  forceIntents: ['research', 'analysis', 'documentation'],
  disablePatterns: [
    '\\bno\\s+retrieval\\b',
    '\\bno\\s+references?\\b',
    '\\bno\\s+sources?\\b',
    '\\bno\\s+research\\b',
    '\\bjust\\s+answer\\b'
  ],
  forcePatterns: [
    '\\bresearch\\b',
    '\\bcompare\\b',
    '\\bbenchmark\\b',
    '\\bliterature\\b'
  ]
};

function evaluateRetrievalGate(goalText, analysis, config = {}) {
  const gate = { ...DEFAULT_RETRIEVAL_GATE, ...(config || {}) };

  if (!gate.enabled) {
    return { enabled: true, reason: 'gate disabled', forced: false };
  }

  const normalized = (goalText || '').toLowerCase();

  const disableHit = (gate.disablePatterns || []).some((pattern) => {
    return new RegExp(pattern, 'i').test(normalized);
  });
  if (disableHit) {
    return { enabled: false, reason: 'disabled by user phrasing', forced: false };
  }

  const forceHit = (gate.forcePatterns || []).some((pattern) => {
    return new RegExp(pattern, 'i').test(normalized);
  });
  if (forceHit) {
    return { enabled: true, reason: 'forced by query pattern', forced: true };
  }

  const primaryIntent = analysis?.intent?.primary;
  if (gate.forceIntents.includes(primaryIntent)) {
    return { enabled: true, reason: `forced by intent (${primaryIntent})`, forced: true };
  }

  if (gate.skipIntents.includes(primaryIntent)) {
    return { enabled: false, reason: `skipped intent (${primaryIntent})`, forced: false };
  }

  const signals = analysis?.signals || {};
  const keywordCount = signals.keywordCount ?? (analysis?.keywords?.length || 0);
  const wordCount = signals.wordCount ?? (goalText ? goalText.split(/\s+/).filter(Boolean).length : 0);
  const hasTechStack =
    signals.hasTechStack ??
    Boolean(
      (analysis?.techStack?.languages || []).length ||
      (analysis?.techStack?.frameworks || []).length ||
      (analysis?.techStack?.tools || []).length ||
      (analysis?.techStack?.platforms || []).length ||
      (analysis?.techStack?.inferred || []).length
    );

  if (keywordCount < gate.minKeywordCount && !hasTechStack && wordCount < gate.minGoalTokens) {
    return { enabled: false, reason: 'insufficient signals for retrieval', forced: false };
  }

  return { enabled: true, reason: 'signals present', forced: false };
}

module.exports = {
  evaluateRetrievalGate,
  DEFAULT_RETRIEVAL_GATE
};
