/**
 * Evaluation Grader - optional LLM-based item scoring.
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

function buildEvaluationMessages({ run, item, output }) {
  const rubric = item.rubric || '';
  const expected = item.expected || '';
  const outputSnippet = output.length > 2000 ? output.slice(0, 2000) : output;
  const system = 'You are an evaluation grader. Return JSON only. No prose.';
  const user = `Goal: ${run.goal}\n\nPrompt: ${item.input}\n\nExpected: ${expected || 'N/A'}\nRubric: ${rubric || 'N/A'}\n\nOutput (truncated):\n${outputSnippet}\n\nReturn JSON:\n{ "score": 0.0-1.0, "status": "pass|fail|needs-review", "rationale": "short reason" }`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

async function gradeItemWithLlm({ run, item, output, llmConfig, decisionConfig }) {
  if (!llmConfig?.enabled) {
    return { used: false, reason: 'llm disabled' };
  }

  const ddriveCheck = checkDDriveRequirement(llmConfig, decisionConfig);
  if (!ddriveCheck.ok) {
    return { used: false, reason: ddriveCheck.reason };
  }

  const messages = buildEvaluationMessages({ run, item, output });
  try {
    const response = await callLlmWithFallback(llmConfig, messages);
    const json = extractJson(response);
    if (!json) return { used: false, reason: 'invalid json' };

    const score = Number.isFinite(Number(json.score)) ? Number(json.score) : null;
    const status = typeof json.status === 'string' ? json.status.toLowerCase() : 'needs-review';
    return {
      used: true,
      score: score === null ? 0 : Math.max(0, Math.min(1, score)),
      status: ['pass', 'fail', 'needs-review'].includes(status) ? status : 'needs-review',
      rationale: typeof json.rationale === 'string' ? json.rationale : null
    };
  } catch (error) {
    return { used: false, reason: error.message };
  }
}

module.exports = {
  gradeItemWithLlm
};
