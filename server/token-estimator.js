/**
 * Token estimation + cost calculation helpers.
 */

function estimateTokens(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3));
}

function estimateTokensFromMessages(messages) {
  if (!Array.isArray(messages)) return 0;
  const combined = messages.map((m) => `${m.role || ''} ${m.content || ''}`).join(' ');
  return estimateTokens(combined);
}

function estimateCost(tokens, llmConfig) {
  const rate = Number(llmConfig?.costPer1kTokens) || 0;
  if (!rate || !tokens) return 0;
  return Math.round((tokens / 1000) * rate * 10000) / 10000;
}

module.exports = {
  estimateTokens,
  estimateTokensFromMessages,
  estimateCost
};
