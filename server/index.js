const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Import new modules
const config = require('./config');
const repoManager = require('./repo-manager');
const logStore = require('./log-store');
const runsStore = require('./runs-store');
const datasetsStore = require('./datasets-store');
const evaluationsStore = require('./evaluations-store');
const { gradeItemWithLlm } = require('./evaluation-grader');
const { templates: evaluationTemplates } = require('./evaluation-templates');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Get current configuration
const appConfig = config.getConfig();

// Log helper (store in memory + console)
function logEvent(message, level = 'info') {
  logStore.addLog(message, level);
  const prefix = level.toUpperCase();
  console.log(`[${prefix}] ${message}`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeEvaluationMetrics(run, dataset) {
  const itemCount = Array.isArray(dataset?.items) ? dataset.items.length : 0;
  const qualityScore = run?.metrics?.qualityScore ?? 0;
  const baseRate = qualityScore / 100;
  const normalized = itemCount > 0 ? clamp(baseRate * 0.9 + 0.1, 0, 1) : clamp(baseRate, 0, 1);
  return {
    itemCount,
    qualityScore,
    passRate: normalized,
    score: Math.round(normalized * 100)
  };
}

function normalizeText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function computeTokenOverlap(a, b) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let hits = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) hits += 1;
  }
  return hits / Math.max(aTokens.size, bTokens.size);
}

function matchExpected(output, item) {
  const expected = item.expected || '';
  const expectedType = item.expectedType || '';
  if (!expected) return { matched: false, method: 'none' };

  const expectedText = expected.trim();
  const isRegex = expectedType === 'regex' || expectedText.toLowerCase().startsWith('regex:');
  if (isRegex) {
    const pattern = expectedText.toLowerCase().startsWith('regex:')
      ? expectedText.slice('regex:'.length).trim()
      : expectedText;
    try {
      const regex = new RegExp(pattern, 'i');
      return { matched: regex.test(output), method: 'regex' };
    } catch (e) {
      return { matched: false, method: 'regex-invalid' };
    }
  }

  const normalizedOutput = normalizeText(output);
  const normalizedExpected = normalizeText(expectedText);
  return { matched: normalizedOutput.includes(normalizedExpected), method: 'contains' };
}

function scoreDatasetItem(run, item, output) {
  const weight = Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1;
  if (!item.expected) {
    const overlap = computeTokenOverlap(run.goal, item.input);
    const heuristic = Math.min(1, Math.max(0, overlap * 0.8));
    return {
      id: item.id,
      input: item.input,
      expected: item.expected,
      expectedType: item.expectedType || null,
      weight,
      score: heuristic,
      status: 'needs-review',
      method: 'heuristic',
      notes: 'No expected string provided; scored via token overlap.'
    };
  }

  const match = matchExpected(output, item);
  return {
    id: item.id,
    input: item.input,
    expected: item.expected,
    expectedType: item.expectedType || null,
    rubric: item.rubric || null,
    weight,
    score: match.matched ? 1 : 0,
    status: match.matched ? 'pass' : 'fail',
    method: match.method,
    notes: match.method === 'regex-invalid' ? 'Invalid regex pattern.' : null
  };
}

function summarizeEvaluation(items, thresholds) {
  const scoredItems = items.filter(item => item.status !== 'needs-review');
  const totalWeight = scoredItems.reduce((sum, item) => sum + (item.weight || 1), 0);
  const weightedScore = scoredItems.reduce((sum, item) => sum + (item.score * (item.weight || 1)), 0);
  const passRate = totalWeight > 0 ? weightedScore / totalWeight : 0;

  let status = 'needs-review';
  if (totalWeight > 0) {
    if (passRate >= thresholds.passThreshold) status = 'pass';
    else if (passRate >= thresholds.warnThreshold) status = 'warn';
    else status = 'fail';
  }

  return {
    passRate,
    status,
    score: Math.round(passRate * 100),
    scoredCount: scoredItems.length,
    needsReviewCount: items.length - scoredItems.length
  };
}

function readRunOutput(run, maxChars) {
  if (run?.outputPath && fs.existsSync(run.outputPath)) {
    try {
      const data = fs.readFileSync(run.outputPath, 'utf8');
      return data.length > maxChars ? data.slice(0, maxChars) : data;
    } catch (e) {}
  }
  return run?.outputPreview || '';
}

// Startup logging
console.log('\n========================================');
console.log('  CORTEX Backend Starting...');
console.log('========================================');
console.log(`  Platform: ${process.platform}`);
console.log(`  Node: ${process.version}`);
console.log(`  Config: ${config.CONFIG_PATH}`);
console.log(`  Repos Root: ${appConfig.reposRoot}`);
console.log(`  First Run: ${config.isFirstRun()}`);
console.log('========================================\n');
logEvent('CORTEX backend started');

// ==========================================
// Configuration API
// ==========================================

// Get current configuration and system info
app.get('/api/config', (req, res) => {
  const currentConfig = config.getConfig();
  const systemInfo = config.getSystemInfo();
  const isFirstRun = config.isFirstRun();

  res.json({
    config: currentConfig,
    system: systemInfo,
    isFirstRun,
    gitAvailable: repoManager.isGitAvailable()
  });
});

// Update configuration
app.post('/api/config', (req, res) => {
  const updates = req.body;

  // Repo root validation is advisory only (do not block saves)
  let validationWarnings = [];
  if (updates.reposRoot) {
    const validation = config.validateReposRoot(updates.reposRoot);
    validationWarnings = [...(validation.errors || []), ...(validation.warnings || [])];
  }

  const newConfig = config.updateConfig(updates);
  if (newConfig) {
    res.json({ success: true, config: newConfig, warnings: validationWarnings });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

// Complete first-run setup
app.post('/api/setup', (req, res) => {
  const { reposRoot, createStructure } = req.body;

  if (!reposRoot) {
    return res.status(400).json({ success: false, error: 'reposRoot is required' });
  }

  // Repo root validation is advisory only (do not block setup)
  const validation = config.validateReposRoot(reposRoot);

  // Create directory structure if requested
  let createdDirs = [];
  if (createStructure) {
    try {
      createdDirs = config.createDirectoryStructure(reposRoot);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: `Failed to create directories: ${e.message}`
      });
    }
  }

  // Complete first run
  const success = config.completeFirstRun(reposRoot);

  if (success) {
    res.json({
      success: true,
      message: 'Setup complete',
      reposRoot,
      createdDirectories: createdDirs,
      warnings: [...(validation.errors || []), ...(validation.warnings || [])]
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration',
      warnings: [...(validation.errors || []), ...(validation.warnings || [])]
    });
  }
});

// Validate a path
app.post('/api/validate-path', (req, res) => {
  const { path: pathToValidate } = req.body;

  if (!pathToValidate) {
    return res.status(400).json({ success: false, error: 'Path is required' });
  }

  const validation = config.validateReposRoot(pathToValidate);
  res.json(validation);
});

// LLM connectivity check (advisory)
app.post('/api/llm/ping', async (req, res) => {
  const { endpoint, model, provider } = req.body || {};
  const llmConfig = config.getConfig().llm || {};
  const target = endpoint || llmConfig.endpoint;
  const selectedModel = model || llmConfig.model || 'gpt-3.5-turbo';
  const selectedProvider = provider || llmConfig.provider;

  if (!target) {
    return res.status(400).json({ success: false, reachable: false, error: 'Endpoint is required' });
  }

  const isOllama = selectedProvider === 'ollama' || /\/api\/chat/i.test(target);
  const payload = isOllama
    ? {
        model: selectedModel,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        options: { temperature: 0, num_predict: 1 }
      }
    : {
        model: selectedModel,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        max_tokens: 1
      };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    res.json({
      success: true,
      endpoint: target,
      reachable: true,
      ok: response.ok,
      status: response.status
    });
  } catch (e) {
    try {
      const response = await fetch(target, { method: 'HEAD', signal: controller.signal });
      res.json({
        success: true,
        endpoint: target,
        reachable: true,
        ok: response.ok,
        status: response.status,
        note: 'HEAD fallback'
      });
    } catch (err) {
      res.json({
        success: false,
        endpoint: target,
        reachable: false,
        error: err.message
      });
    }
  } finally {
    clearTimeout(timeout);
  }
});

// Get default paths suggestion
app.get('/api/default-paths', (req, res) => {
  res.json({
    reposRoot: config.getDefaultReposRoot(),
    outputDir: config.getDefaultOutputDir()
  });
});

// Browse directories - returns list of subdirectories at a given path
app.get('/api/browse', (req, res) => {
  const requestedPath = req.query.path || '';
  const os = require('os');

  let targetPath;

  // Handle empty path - return drives on Windows, root dirs on Unix
  if (!requestedPath) {
    if (process.platform === 'win32') {
      // Return common drives on Windows
      const drives = [];
      for (const letter of ['C', 'D', 'E', 'F']) {
        const drivePath = `${letter}:\\`;
        try {
          fs.accessSync(drivePath, fs.constants.R_OK);
          drives.push({ name: `${letter}:`, path: drivePath, isDirectory: true });
        } catch (e) {
          // Drive doesn't exist or not accessible
        }
      }
      return res.json({
        path: '',
        parent: null,
        items: drives
      });
    } else {
      targetPath = '/';
    }
  } else {
    targetPath = requestedPath;
  }

  // Normalize path
  targetPath = path.normalize(targetPath);

  // Check if path exists and is accessible
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
  } catch (e) {
    return res.status(400).json({
      success: false,
      error: 'Path does not exist or is not accessible'
    });
  }

  // Check if it's a directory
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({
      success: false,
      error: 'Path is not a directory'
    });
  }

  // Read directory contents
  try {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = entries
      .filter(entry => {
        // Only show directories, skip hidden files on Unix
        if (!entry.isDirectory()) return false;
        if (entry.name.startsWith('.') && process.platform !== 'win32') return false;
        // Skip system directories
        if (['$RECYCLE.BIN', 'System Volume Information', 'node_modules'].includes(entry.name)) return false;
        return true;
      })
      .map(entry => ({
        name: entry.name,
        path: path.join(targetPath, entry.name),
        isDirectory: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calculate parent path
    const parentPath = path.dirname(targetPath);
    const hasParent = parentPath !== targetPath;

    res.json({
      path: targetPath,
      parent: hasParent ? parentPath : null,
      items
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: `Failed to read directory: ${e.message}`
    });
  }
});

// ==========================================
// Status & Repository API
// ==========================================

app.get('/api/status', (req, res) => {
  const currentConfig = config.getConfig();
  res.json({
    status: 'Online',
    reposRoot: currentConfig.reposRoot,
    isFirstRun: config.isFirstRun(),
    gitAvailable: repoManager.isGitAvailable()
  });
});

app.get('/api/repos', (req, res) => {
  try {
    const repos = repoManager.loadRegistry();
    res.json(repos);
  } catch (e) {
    console.error('Repo read error:', e);
    res.status(500).json({ error: 'Failed to read registry' });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const categories = repoManager.getCategories();
    res.json(categories);
  } catch (e) {
    console.error('Categories read error:', e);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

app.get('/api/category-sizes', (req, res) => {
  try {
    const sizes = repoManager.getCategorySizes();
    res.json(sizes);
  } catch (e) {
    console.error('Category size error:', e);
    res.status(500).json({ error: 'Failed to compute category sizes' });
  }
});

// Scan for repositories (cross-platform Node.js)
app.post('/api/scan', (req, res) => {
  try {
    const results = repoManager.scanRepositories((msg) => {
      console.log(`[SCAN] ${msg}`);
    });

    res.json({
      success: true,
      output: `Found ${results.found.length} repositories (${results.newRepos} new)`,
      results
    });
  } catch (e) {
    console.error('[SCAN ERROR]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Clone a repository (cross-platform Node.js)
app.post('/api/add', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  const trimmedUrl = url.trim();
  const isValidUrl =
    /^https?:\/\//i.test(trimmedUrl) ||
    /^ssh:\/\//i.test(trimmedUrl) ||
    /^git@[^:]+:.+/i.test(trimmedUrl) ||
    /^file:\/\//i.test(trimmedUrl) ||
    fs.existsSync(trimmedUrl) ||
    path.isAbsolute(trimmedUrl);
  if (!isValidUrl) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_URL',
      error: 'Invalid repository URL. Use https://, ssh://, git@host:path, file://, or a local path.'
    });
  }

  try {
    const result = await repoManager.cloneRepository(trimmedUrl, (msg) => {
      console.log(`[CLONE] ${msg}`);
    });

    if (result.success) {
      res.json({
        success: true,
        output: `Cloned ${result.repo.name} to ${result.repo.category}`,
        repo: result.repo
      });
    } else {
      res.status(400).json({
        success: false,
        code: result.code,
        error: result.error,
        repo: result.repo
      });
    }
  } catch (e) {
    console.error('[CLONE ERROR]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Remove a repository
app.delete('/api/repos/:name', (req, res) => {
  const { name } = req.params;
  const { deleteFiles } = req.query;

  const result = repoManager.removeRepository(name, deleteFiles === 'true');

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Update a repository
app.post('/api/repos/:name/update', (req, res) => {
  const { name } = req.params;
  const result = repoManager.updateRepository(name);

  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// ==========================================
// Orchestrator API
// ==========================================

app.post('/api/spawn', (req, res) => {
  const { goal, format } = req.body;
  if (!goal) {
    return res.status(400).json({ error: 'Goal required' });
  }

  const orchestratorPath = path.join(__dirname, 'orchestrator.js');
  const allowedFormats = new Set(['universal', 'chatgpt', 'claude', 'gemini']);
  const normalizedFormat = allowedFormats.has((format || '').toLowerCase())
    ? format.toLowerCase()
    : 'universal';

  console.log(`[ORCHESTRATOR] Spawning: ${goal} (format: ${normalizedFormat})`);

  // Use spawn with array arguments (cross-platform safe)
  const child = spawn('node', [orchestratorPath, goal, normalizedFormat], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      REPOS_ROOT: config.getConfig().reposRoot
    }
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log(`[ORCHESTRATOR] ${data.toString().trim()}`);
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
    console.error(`[ORCHESTRATOR ERR] ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error('[ORCHESTRATOR] Process error:', err);
    res.status(500).json({ success: false, error: err.message });
  });

  child.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: `Orchestrator exited with code ${code}`,
        output: stdout + stderr
      });
    }

    // Record analytics
    config.recordSpawn(goal, 'std-agent', 0);

    res.json({ success: true, output: stdout });
  });
});

// ==========================================
// Analytics API
// ==========================================

app.get('/api/analytics', (req, res) => {
  const analytics = config.getAnalytics();
  res.json(analytics);
});

// ==========================================
// Session History API (for P1: Session Persistence)
// ==========================================

const SESSIONS_FILE = path.join(__dirname, '..', 'sessions.json');

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading sessions:', e);
  }
  return [];
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

app.get('/api/sessions', (req, res) => {
  const sessions = loadSessions();
  res.json(sessions.slice(-20).reverse()); // Last 20, newest first
});

app.post('/api/sessions', (req, res) => {
  const { goal, agent, resources, output } = req.body;

  const sessions = loadSessions();
  const session = {
    id: `session-${Date.now()}`,
    timestamp: new Date().toISOString(),
    goal,
    agent,
    resources,
    outputPreview: output ? output.substring(0, 500) : null
  };

  sessions.push(session);

  // Keep only last 50 sessions
  const trimmed = sessions.slice(-50);
  saveSessions(trimmed);

  res.json({ success: true, session });
});

// ==========================================
// Runs & Observability API
// ==========================================

app.get('/api/runs', (req, res) => {
  const runs = runsStore.loadRuns();
  const limit = Number(req.query.limit);
  if (!Number.isNaN(limit) && limit > 0) {
    return res.json(runs.slice(0, limit));
  }
  res.json(runs);
});

app.get('/api/runs/:id', (req, res) => {
  const run = runsStore.getRun(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  res.json(run);
});

// ==========================================
// Agents Registry API
// ==========================================

app.get('/api/agents', (req, res) => {
  const currentConfig = config.getConfig();
  const agentsDir = path.join(currentConfig.reposRoot, 'agents');

  if (!fs.existsSync(agentsDir)) {
    return res.json([]);
  }

  const agents = [];

  fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter(dir => dir.isDirectory() && !dir.name.startsWith('.'))
    .forEach((dir) => {
      const agentPath = path.join(agentsDir, dir.name);
      const templatePath = fs.existsSync(path.join(agentPath, 'template.md'))
        ? path.join(agentPath, 'template.md')
        : path.join(agentPath, 'README.md');
      let description = '';
      let name = dir.name;
      let keywords = [];

      const configPath = path.join(agentPath, 'agent.config.json');
      if (fs.existsSync(configPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          name = data.name || name;
          description = data.description || description;
          keywords = Array.isArray(data.keywords) ? data.keywords : keywords;
        } catch (e) {}
      }

      if (fs.existsSync(templatePath) && !description) {
        try {
          const content = fs.readFileSync(templatePath, 'utf8');
          const firstLine = content.split('\n').find(line => line.trim() && !line.startsWith('#'));
          if (firstLine) description = firstLine.trim().substring(0, 140);
        } catch (e) {}
      }

      agents.push({
        id: dir.name,
        name,
        description: description || 'No description provided.',
        keywords,
        path: agentPath,
        templatePath: fs.existsSync(templatePath) ? templatePath : null
      });
    });

  res.json(agents);
});

// ==========================================
// Datasets & Evaluations API
// ==========================================

app.get('/api/datasets', (req, res) => {
  const datasets = datasetsStore.loadDatasets();
  res.json(datasets);
});

app.get('/api/datasets/:id', (req, res) => {
  const dataset = datasetsStore.getDataset(req.params.id);
  if (!dataset) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  res.json(dataset);
});

app.get('/api/datasets/:id/export', (req, res) => {
  const dataset = datasetsStore.getDataset(req.params.id);
  if (!dataset) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  const safeName = (dataset.name || 'dataset').replace(/[^a-z0-9-_]+/gi, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`);
  res.json({ dataset });
});

app.post('/api/datasets', (req, res) => {
  const { name, description } = req.body || {};
  if (!name) {
    return res.status(400).json({ success: false, error: 'Dataset name is required' });
  }
  const dataset = datasetsStore.createDataset({ name, description });
  res.json({ success: true, dataset });
});

app.post('/api/datasets/import', (req, res) => {
  const payload = req.body?.dataset || req.body;
  if (!payload || !payload.name) {
    return res.status(400).json({ success: false, error: 'Dataset payload with name is required' });
  }

  const dataset = datasetsStore.importDataset(payload);
  if (!dataset) {
    return res.status(500).json({ success: false, error: 'Failed to import dataset' });
  }
  res.json({ success: true, dataset });
});

app.put('/api/datasets/:id', (req, res) => {
  const { name, description } = req.body || {};
  const updated = datasetsStore.updateDataset(req.params.id, { name, description });
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  res.json({ success: true, dataset: updated });
});

app.delete('/api/datasets/:id', (req, res) => {
  const success = datasetsStore.deleteDataset(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  res.json({ success: true });
});

app.post('/api/datasets/:id/items', (req, res) => {
  const { input, expected, tags, weight, expectedType, rubric } = req.body || {};
  if (!input) {
    return res.status(400).json({ success: false, error: 'Item input is required' });
  }
  const item = datasetsStore.addDatasetItem(req.params.id, { input, expected, tags, weight, expectedType, rubric });
  if (!item) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  res.json({ success: true, item });
});

app.delete('/api/datasets/:id/items/:itemId', (req, res) => {
  const success = datasetsStore.removeDatasetItem(req.params.id, req.params.itemId);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }
  res.json({ success: true });
});

app.get('/api/evaluations', (req, res) => {
  const evaluations = evaluationsStore.loadEvaluations();
  res.json(evaluations);
});

app.get('/api/evaluation-templates', (req, res) => {
  res.json(evaluationTemplates);
});

app.post('/api/evaluations', async (req, res) => {
  const { datasetId, runId, name } = req.body || {};
  if (!datasetId || !runId) {
    return res.status(400).json({ success: false, error: 'datasetId and runId are required' });
  }

  const dataset = datasetsStore.getDataset(datasetId);
  const run = runsStore.getRun(runId);
  if (!dataset) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  if (!run) {
    return res.status(404).json({ success: false, error: 'Run not found' });
  }

  const fullConfig = config.getConfig();
  const evaluationConfig = fullConfig.evaluation || {};
  const llmConfig = fullConfig.llm || {};
  const decisionConfig = fullConfig.decisionMatrix || {};
  const maxChars = evaluationConfig.maxOutputChars ?? 120000;
  const output = readRunOutput(run, maxChars);
  const llmEnabled = evaluationConfig.llmGraderEnabled !== false && llmConfig.enabled === true;
  const maxLlmItems = evaluationConfig.llmMaxItems ?? 12;
  let llmUsedCount = 0;
  const items = [];

  for (const item of (dataset.items || [])) {
    const wantsLlm = item.expectedType === 'llm' || Boolean(item.rubric);
    if (llmEnabled && wantsLlm && llmUsedCount < maxLlmItems) {
      const graded = await gradeItemWithLlm({ run, item, output, llmConfig, decisionConfig });
      if (graded.used) {
        llmUsedCount += 1;
        items.push({
          id: item.id,
          input: item.input,
          expected: item.expected,
          expectedType: item.expectedType || 'llm',
          rubric: item.rubric || null,
          weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1,
          score: graded.score,
          status: graded.status,
          method: 'llm',
          notes: graded.rationale || null
        });
        continue;
      }
    }

    items.push(scoreDatasetItem(run, item, output));
  }
  const summary = summarizeEvaluation(items, {
    passThreshold: evaluationConfig.passThreshold ?? 0.75,
    warnThreshold: evaluationConfig.warnThreshold ?? 0.6
  });
  const metrics = {
    ...computeEvaluationMetrics(run, dataset),
    passRate: summary.passRate,
    score: summary.score,
    status: summary.status,
    scoredCount: summary.scoredCount,
    needsReviewCount: summary.needsReviewCount
  };
  const evaluation = {
    id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || `${dataset.name} • ${new Date().toLocaleDateString()}`,
    datasetId,
    datasetName: dataset.name,
    runId,
    runGoal: run.goal,
    createdAt: new Date().toISOString(),
    status: summary.status,
    metrics,
    items
  };

  evaluationsStore.recordEvaluation(evaluation);
  res.json({ success: true, evaluation });
});

app.get('/api/evaluations/compare', (req, res) => {
  const leftId = req.query.left;
  const rightId = req.query.right;
  if (!leftId || !rightId) {
    return res.status(400).json({ error: 'left and right evaluation ids are required' });
  }
  const left = evaluationsStore.getEvaluation(leftId);
  const right = evaluationsStore.getEvaluation(rightId);
  if (!left || !right) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }

  const delta = {
    score: (right.metrics?.score ?? 0) - (left.metrics?.score ?? 0),
    passRate: (right.metrics?.passRate ?? 0) - (left.metrics?.passRate ?? 0),
    itemCount: (right.metrics?.itemCount ?? 0) - (left.metrics?.itemCount ?? 0)
  };

  res.json({ left, right, delta });
});

// ==========================================
// Saved Prompts API
// ==========================================

// Get all saved prompts
app.get('/api/prompts', (req, res) => {
  const prompts = config.getSavedPrompts();
  res.json(prompts);
});

// Save a new prompt
app.post('/api/prompts', (req, res) => {
  const { title, query } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  const prompt = config.savePrompt(title, query);
  res.json({ success: true, prompt });
});

// Update a prompt
app.put('/api/prompts/:id', (req, res) => {
  const { id } = req.params;
  const { title, query } = req.body;

  const prompt = config.updatePrompt(id, { title, query });

  if (prompt) {
    res.json({ success: true, prompt });
  } else {
    res.status(404).json({ success: false, error: 'Prompt not found' });
  }
});

// Delete a prompt
app.delete('/api/prompts/:id', (req, res) => {
  const { id } = req.params;

  const success = config.deletePrompt(id);

  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Prompt not found' });
  }
});

// ==========================================
// Tools Registry API (for P1: Tools Registry)
// ==========================================

app.get('/api/tools', (req, res) => {
  const currentConfig = config.getConfig();
  const toolsDir = path.join(currentConfig.reposRoot, 'tools');

  if (!fs.existsSync(toolsDir)) {
    return res.json([]);
  }

  const tools = [];

  fs.readdirSync(toolsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .forEach(dir => {
      const toolPath = path.join(toolsDir, dir.name);

      // Try to load tool metadata
      let metadata = { name: dir.name, description: 'No description' };

      // Check for package.json
      const pkgPath = path.join(toolPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          metadata = {
            name: pkg.name || dir.name,
            description: pkg.description || 'No description',
            version: pkg.version,
            type: 'npm'
          };
        } catch (e) {}
      }

      // Check for README
      const readmePath = path.join(toolPath, 'README.md');
      if (fs.existsSync(readmePath) && !metadata.description) {
        try {
          const readme = fs.readFileSync(readmePath, 'utf8');
          const firstLine = readme.split('\n').find(l => l.trim() && !l.startsWith('#'));
          if (firstLine) metadata.description = firstLine.substring(0, 100);
        } catch (e) {}
      }

      tools.push({
        id: dir.name,
        path: toolPath,
        ...metadata
      });
    });

  res.json(tools);
});

// ==========================================
// Start Server
// ==========================================

app.listen(PORT, () => {
  console.log(`\n  CORTEX Backend running on http://localhost:${PORT}`);
  console.log(`  API endpoints available at http://localhost:${PORT}/api\n`);

  if (config.isFirstRun()) {
    console.log('  First run detected - setup wizard will appear in UI\n');
  }
});
