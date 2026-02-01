/**
 * LLM Reranker - Optional Qwen2.5 14B Instruct Q4 rerank layer
 * Uses a strict JSON response and safe fallbacks.
 */

const DEFAULT_TIMEOUT_MS = 10000;

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

function isDDrivePath(value) {
  if (!value || typeof value !== 'string') return false;
  return value.toLowerCase().startsWith('d:\\') || value.toLowerCase().startsWith('d:/');
}

function checkDDriveRequirement(llmConfig, decisionConfig) {
  if (!decisionConfig?.requireDDrive || process.platform !== 'win32') {
    return { ok: true };
  }

  if (llmConfig?.allowRemote && !isLocalEndpoint(llmConfig.endpoint)) {
    return { ok: true };
  }

  const modelPath = llmConfig.modelPath || '';
  const modelDir = llmConfig.modelDir || '';
  const ollamaDir = process.env.OLLAMA_MODELS || '';

  const onDDrive = [modelPath, modelDir, ollamaDir].some(isDDrivePath);
  if (!onDDrive) {
    return { ok: false, reason: 'LLM model path is not on D: drive' };
  }

  return { ok: true };
}

function shouldRerankByGap(items, gapThreshold) {
  if (!items || items.length < 2) return false;
  const [first, second] = items;
  if (typeof first.score !== 'number' || typeof second.score !== 'number') return true;
  return Math.abs(first.score - second.score) < gapThreshold;
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const snippet = text.substring(start, end + 1);
  try {
    return JSON.parse(snippet);
  } catch {
    return null;
  }
}

function normalizeOrder(order, idSet) {
  if (!Array.isArray(order)) return null;
  const normalized = order.filter(id => idSet.has(id));
  if (normalized.length !== idSet.size) return null;
  return normalized;
}

async function callOpenAICompatible(llmConfig, messages) {
  const endpoint = llmConfig.endpoint;
  const payload = {
    model: llmConfig.model,
    messages,
    temperature: llmConfig.temperature,
    max_tokens: llmConfig.maxTokens
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llmConfig.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callOllama(llmConfig, messages) {
  const endpoint = llmConfig.endpoint || 'http://localhost:11434/api/chat';
  const payload = {
    model: llmConfig.model,
    messages,
    stream: false,
    options: {
      temperature: llmConfig.temperature,
      num_predict: llmConfig.maxTokens
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llmConfig.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callLlm(llmConfig, messages) {
  if (llmConfig.provider === 'ollama') {
    return callOllama(llmConfig, messages);
  }
  return callOpenAICompatible(llmConfig, messages);
}

async function callLlmWithFallback(llmConfig, messages) {
  try {
    return await callLlm(llmConfig, messages);
  } catch (error) {
    if (!llmConfig?.fallbackEndpoint) {
      throw error;
    }
    const fallbackConfig = {
      ...llmConfig,
      endpoint: llmConfig.fallbackEndpoint
    };
    return callLlm(fallbackConfig, messages);
  }
}

function buildAgentMessages(goal, candidates) {
  const candidateText = candidates.map((c, index) => {
    return `${index + 1}) id: ${c.agentId}, name: ${c.agentName}, score: ${Math.round(c.score)}, confidence: ${Math.round(c.confidence * 100)}%`;
  }).join('\n');

  return [
    {
      role: 'system',
      content: 'You are a strict reranker. Return JSON only. No prose.'
    },
    {
      role: 'user',
      content: `Goal: ${goal}\n\nCandidates:\n${candidateText}\n\nReturn JSON:\n{ "order": ["id1","id2"], "scores": {"id1": 0.91, "id2": 0.82} }`
    }
  ];
}

function buildResourceMessages(goal, category, candidates) {
  const candidateText = candidates.map((c, index) => {
    return `${index + 1}) id: ${c.file}, category: ${category}, score: ${c.score}, isInstruction: ${c.isInstruction ? 'yes' : 'no'}, preview: ${c.preview}`;
  }).join('\n');

  return [
    {
      role: 'system',
      content: 'You are a strict reranker. Return JSON only. No prose.'
    },
    {
      role: 'user',
      content: `Goal: ${goal}\n\nCandidates:\n${candidateText}\n\nRules:\n- If any candidate isInstruction=yes (AGENTS.md), it must appear first.\n- Do not drop candidates.\n\nReturn JSON:\n{ "order": ["id1","id2"], "scores": {"id1": 0.91, "id2": 0.82} }`
    }
  ];
}

async function rerankAgents({ goal, candidates, llmConfig, decisionConfig }) {
  if (!llmConfig?.enabled) return { candidates, used: false, reason: 'llm disabled' };

  const ddriveCheck = checkDDriveRequirement(llmConfig, decisionConfig);
  if (!ddriveCheck.ok) {
    return { candidates, used: false, reason: ddriveCheck.reason };
  }

  const rerankGap = decisionConfig?.rerankGap ?? 0.12;
  if (!shouldRerankByGap(candidates, rerankGap)) {
    return { candidates, used: false, reason: 'deterministic gap strong' };
  }

  const messages = buildAgentMessages(goal, candidates);
  try {
    const response = await callLlmWithFallback(llmConfig, messages);
    const json = extractJson(response);
    if (!json) return { candidates, used: false, reason: 'invalid json' };

    const ids = new Set(candidates.map(c => c.agentId));
    const order = normalizeOrder(json.order, ids);
    if (!order) return { candidates, used: false, reason: 'invalid order' };

    const byId = new Map(candidates.map(c => [c.agentId, c]));
    const reranked = order.map(id => byId.get(id));
    return { candidates: reranked, used: true };
  } catch (error) {
    return { candidates, used: false, reason: error.message };
  }
}

async function rerankResources({ goal, resourcesByCategory, llmConfig, decisionConfig }) {
  if (!llmConfig?.enabled) return { resourcesByCategory, used: false, reason: 'llm disabled' };

  const ddriveCheck = checkDDriveRequirement(llmConfig, decisionConfig);
  if (!ddriveCheck.ok) {
    return { resourcesByCategory, used: false, reason: ddriveCheck.reason };
  }

  const topN = llmConfig.topN || 6;
  const reranked = {};
  let used = false;

  for (const [category, resources] of Object.entries(resourcesByCategory)) {
    if (!resources || resources.length < 2) {
      reranked[category] = resources;
      continue;
    }

    const candidates = resources.slice(0, topN);
    const messages = buildResourceMessages(goal, category, candidates);
    try {
      const response = await callLlmWithFallback(llmConfig, messages);
      const json = extractJson(response);
      if (!json) {
        reranked[category] = resources;
        continue;
      }

      const ids = new Set(candidates.map(c => c.file));
      const order = normalizeOrder(json.order, ids);
      if (!order) {
        reranked[category] = resources;
        continue;
      }

      const byId = new Map(candidates.map(c => [c.file, c]));
      const reorderedTop = order.map(id => byId.get(id));

      const instructionFirst = reorderedTop.filter(r => r.isInstruction);
      const remainderTop = reorderedTop.filter(r => !r.isInstruction);
      const rebuiltTop = instructionFirst.concat(remainderTop);

      reranked[category] = rebuiltTop.concat(resources.slice(topN));
      used = true;
    } catch {
      reranked[category] = resources;
    }
  }

  return { resourcesByCategory: reranked, used };
}

module.exports = {
  rerankAgents,
  rerankResources
};
