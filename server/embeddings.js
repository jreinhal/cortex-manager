/**
 * Embeddings helper - OpenAI-compatible embeddings endpoint.
 */

const { getConfig } = require('./config');

function isLocalEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return true;
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
  } catch {
    return true;
  }
}

async function embedTexts(inputs, options = {}) {
  const config = getConfig();
  const embeddingConfig = {
    ...(config.vectorIndex?.embedding || {}),
    ...(options.embedding || {})
  };
  const endpoint = options.endpoint || embeddingConfig.endpoint;
  const model = options.model || embeddingConfig.model;
  const allowRemote = embeddingConfig.allowRemote === true;
  const timeoutMs = Number.isFinite(Number(embeddingConfig.timeoutMs)) ? Number(embeddingConfig.timeoutMs) : 12000;
  const apiKey = embeddingConfig.apiKey || null;

  if (!endpoint) {
    throw new Error('Embedding endpoint not configured');
  }
  if (!allowRemote && !isLocalEndpoint(endpoint)) {
    throw new Error('Remote embedding endpoints are disabled');
  }
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return [];
  }

  const payload = {
    model,
    input: inputs
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Embedding request failed (${response.status})`);
    }
    const data = await response.json();
    const entries = Array.isArray(data.data) ? data.data : [];
    const ordered = entries
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((entry) => entry.embedding);
    if (ordered.length !== inputs.length) {
      throw new Error('Embedding response size mismatch');
    }
    return ordered;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  embedTexts
};
