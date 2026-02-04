const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import new modules
const config = require('./config');
const repoManager = require('./repo-manager');
const logStore = require('./log-store');
const runsStore = require('./runs-store');
const datasetsStore = require('./datasets-store');
const evaluationsStore = require('./evaluations-store');
const { gradeItemWithLlm } = require('./evaluation-grader');
const evaluationTemplatesStore = require('./evaluation-templates-store');
const { recordAudit, AUDIT_PATH } = require('./audit-log');
const { readJsonFile, writeJsonAtomic } = require('./storage');
const auth = require('./auth');
const authStore = require('./auth-store');
const jobQueue = require('./job-queue');
const vectorIndex = require('./vector-index');
const { summarizeObservability } = require('./observability');
const { estimateTokens, estimateCost } = require('./token-estimator');
const workspaces = require('./workspaces');
const { analyzeGoal } = require('./goal-analyzer');
const { findResources } = require('./resource-matcher');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(auth.middleware);
app.use((req, res, next) => {
  req.workspace = workspaces.resolveWorkspace(req);
  req.workspaceId = req.workspace?.id || workspaces.getDefaultWorkspace().id;
  next();
});

// Get current configuration
const appConfig = config.getConfig();

// Log helper (store in memory + console)
function logEvent(message, level = 'info') {
  logStore.addLog(message, level);
  const prefix = level.toUpperCase();
  console.log(`[${prefix}] ${message}`);
}

function audit(event, metadata, req) {
  recordAudit(event, metadata, req);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function matchesWorkspace(record, workspaceId) {
  if (!workspaceId) return true;
  if (!record?.workspaceId) return workspaces.isDefaultWorkspace(workspaceId);
  return record.workspaceId === workspaceId;
}

function readAuditEntries({ limit = 200, workspaceId = null, event = null }) {
  if (!fs.existsSync(AUDIT_PATH)) return [];
  try {
    const lines = fs.readFileSync(AUDIT_PATH, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    const entries = [];
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        const parsed = JSON.parse(lines[i]);
        if (workspaceId && !matchesWorkspace(parsed, workspaceId)) {
          continue;
        }
        if (event && parsed.event !== event) {
          continue;
        }
        entries.push(parsed);
        if (entries.length >= limit) break;
      } catch {
        // skip invalid line
      }
    }
    return entries;
  } catch (e) {
    console.error('Failed to read audit log:', e.message);
    return [];
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatAuditCsv(entries) {
  const header = [
    'timestamp',
    'event',
    'username',
    'role',
    'workspace',
    'ip',
    'userAgent',
    'metadata'
  ];
  const rows = entries.map((entry) => ([
    entry.ts || '',
    entry.event || '',
    entry.user?.username || '',
    entry.user?.role || '',
    entry.workspaceId || '',
    entry.ip || '',
    entry.userAgent || '',
    JSON.stringify(entry.metadata || {})
  ]));

  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
}

function normalizePathValue(value) {
  return (value || '').toString().replace(/\\/g, '/').toLowerCase();
}

function parseExpectedPaths(item) {
  if (Array.isArray(item.expectedPaths) && item.expectedPaths.length > 0) {
    return item.expectedPaths.map(normalizePathValue).filter(Boolean);
  }
  if (typeof item.expected === 'string' && item.expected.trim()) {
    return item.expected
      .split(',')
      .map((part) => normalizePathValue(part.trim()))
      .filter(Boolean);
  }
  return [];
}

async function runRetrievalBenchmark({ dataset, reposRoot, decisionConfig, vectorConfig, workspaceId, topK = 5 }) {
  const items = [];
  const scoring = [];
  for (const item of dataset.items || []) {
    const expectedPaths = parseExpectedPaths(item);
    if (expectedPaths.length === 0) {
      items.push({
        id: item.id,
        input: item.input,
        expectedPaths: [],
        status: 'needs-review',
        precision: 0,
        recall: 0,
        mrr: 0,
        matches: []
      });
      continue;
    }

    const analysis = analyzeGoal(item.input || '', { decisionConfig });
    const resources = await findResources(analysis, reposRoot, {
      maxResults: Math.max(topK, decisionConfig.maxCandidates || 6),
      minScore: 0.1,
      rrf: decisionConfig.rrf || {},
      ragFusion: decisionConfig.ragFusion || {},
      hyde: decisionConfig.hyde || {},
      hybrid: decisionConfig.hybridRetrieval || {},
      vectorIndex: vectorConfig || {},
      retrievalEnabled: true,
      workspaceId
    });

    const flattened = ['knowledge', 'skills', 'tools']
      .flatMap((cat) => resources[cat] || [])
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((resource, idx) => {
        const relativePath = normalizePathValue(resource.relativePath || path.relative(reposRoot, resource.filePath || ''));
        return {
          rank: idx + 1,
          filePath: resource.filePath,
          relativePath,
          score: resource.score
        };
      });

    const matches = flattened.filter((result) =>
      expectedPaths.some((expected) => result.relativePath.endsWith(expected) || result.relativePath.includes(expected))
    );
    const hitCount = matches.length;
    const precision = topK > 0 ? hitCount / topK : 0;
    const recall = expectedPaths.length > 0 ? hitCount / expectedPaths.length : 0;
    const firstHitRank = matches.length > 0 ? matches[0].rank : null;
    const mrr = firstHitRank ? 1 / firstHitRank : 0;

    items.push({
      id: item.id,
      input: item.input,
      expectedPaths,
      status: hitCount > 0 ? 'pass' : 'fail',
      precision,
      recall,
      mrr,
      matches: flattened
    });
    scoring.push({ precision, recall, mrr });
  }

  const scoredCount = scoring.length;
  const avg = (key) => scoredCount > 0
    ? scoring.reduce((sum, entry) => sum + entry[key], 0) / scoredCount
    : 0;

  return {
    items,
    metrics: {
      topK,
      itemCount: dataset.items?.length || 0,
      scoredCount,
      precisionAtK: avg('precision'),
      recallAtK: avg('recall'),
      mrr: avg('mrr'),
      score: Math.round(avg('recall') * 100)
    }
  };
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
app.get('/api/config', auth.requirePermission('config', 'read', 'viewer'), (req, res) => {
  const currentConfig = config.getConfig();
  const safeConfig = {
    ...currentConfig,
    auth: {
      ...(currentConfig.auth || {}),
      secret: null,
      scim: {
        ...(currentConfig.auth?.scim || {}),
        token: null
      }
    }
  };
  const systemInfo = config.getSystemInfo();
  const isFirstRun = config.isFirstRun();

  res.json({
    config: safeConfig,
    system: systemInfo,
    isFirstRun,
    gitAvailable: repoManager.isGitAvailable()
  });
});

// Update configuration
app.post('/api/config', auth.requirePermission('config', 'update', 'admin'), (req, res) => {
  const updates = req.body || {};
  if (updates.auth && Object.prototype.hasOwnProperty.call(updates.auth, 'secret')) {
    delete updates.auth.secret;
  }
  if (updates.auth?.scim && Object.prototype.hasOwnProperty.call(updates.auth.scim, 'token')) {
    delete updates.auth.scim.token;
  }

  // Repo root validation is advisory only (do not block saves)
  let validationWarnings = [];
  if (updates.reposRoot) {
    const validation = config.validateReposRoot(updates.reposRoot);
    validationWarnings = [...(validation.errors || []), ...(validation.warnings || [])];
  }

  const current = config.getConfig();
  const merged = {
    ...current,
    ...updates,
    auth: { ...(current.auth || {}), ...(updates.auth || {}) },
    llm: { ...(current.llm || {}), ...(updates.llm || {}) },
    ui: { ...(current.ui || {}), ...(updates.ui || {}) },
    queue: { ...(current.queue || {}), ...(updates.queue || {}) },
    vectorIndex: { ...(current.vectorIndex || {}), ...(updates.vectorIndex || {}) },
    observability: { ...(current.observability || {}), ...(updates.observability || {}) },
    decisionMatrix: { ...(current.decisionMatrix || {}), ...(updates.decisionMatrix || {}) },
    evaluation: { ...(current.evaluation || {}), ...(updates.evaluation || {}) },
    workspaces: updates.workspaces ? { ...(current.workspaces || {}), ...(updates.workspaces || {}) } : (current.workspaces || {})
  };

  const newConfig = config.updateConfig(merged);
  if (newConfig) {
    audit('config.update', { keys: Object.keys(updates || {}) }, req);
    res.json({ success: true, config: newConfig, warnings: validationWarnings });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

// ==========================================
// Authentication API
// ==========================================

app.get('/api/auth/status', (req, res) => {
  const currentConfig = config.getConfig();
  const enabled = currentConfig.auth?.enabled === true;
  const hasUsers = authStore.hasUsers();
  res.json({
    enabled,
    bootstrapAllowed: currentConfig.auth?.bootstrapAllowed !== false,
    bootstrapNeeded: enabled && !hasUsers,
    roles: ['viewer', 'editor', 'admin'],
    rbac: {
      enabled: currentConfig.auth?.rbac?.enabled !== false
    },
    sso: {
      enabled: currentConfig.auth?.sso?.enabled === true,
      mode: currentConfig.auth?.sso?.mode || 'header',
      headerUser: currentConfig.auth?.sso?.headerUser || 'x-cortex-user',
      headerRole: currentConfig.auth?.sso?.headerRole || 'x-cortex-role',
      headerWorkspace: currentConfig.auth?.sso?.headerWorkspace || 'x-cortex-workspace',
      autoProvision: currentConfig.auth?.sso?.autoProvision !== false
    },
    scim: {
      enabled: currentConfig.auth?.scim?.enabled === true
    }
  });
});

app.post('/api/auth/bootstrap', (req, res) => {
  const currentConfig = config.getConfig();
  if (currentConfig.auth?.enabled !== true) {
    return res.status(400).json({ success: false, error: 'Auth is disabled' });
  }
  if (currentConfig.auth?.bootstrapAllowed === false) {
    return res.status(403).json({ success: false, error: 'Bootstrap is disabled' });
  }
  if (authStore.hasUsers()) {
    return res.status(400).json({ success: false, error: 'Users already exist' });
  }

  const { username, password, workspaceId } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const user = authStore.createUser({
    username,
    password,
    role: 'admin',
    workspaceId: workspaceId || req.workspaceId || null
  });
  if (!user) {
    return res.status(500).json({ success: false, error: 'Failed to create admin user' });
  }
  const token = auth.issueToken(user);
  authStore.recordLogin(user.id);
  audit('auth.bootstrap', { username: user.username }, req);
  res.json({ success: true, token, user });
});

app.post('/api/auth/login', (req, res) => {
  const currentConfig = config.getConfig();
  if (currentConfig.auth?.enabled !== true) {
    return res.status(400).json({ success: false, error: 'Auth is disabled' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }
  const user = authStore.verifyLogin(username, password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  authStore.recordLogin(user.id);
  const token = auth.issueToken(user);
  audit('auth.login', { username: user.username }, req);
  res.json({ success: true, token, user });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: req.user });
});

// ==========================================
// Workspaces API
// ==========================================

app.get('/api/workspaces', auth.requirePermission('workspaces', 'read', 'viewer'), (req, res) => {
  const all = workspaces.listWorkspaces();
  if (req.user?.role === 'admin') {
    return res.json(all);
  }
  const scoped = workspaces.resolveWorkspace(req);
  return res.json(scoped ? [scoped] : []);
});

app.get('/api/workspaces/active', auth.requirePermission('workspaces', 'read', 'viewer'), (req, res) => {
  const current = workspaces.resolveWorkspace(req);
  const list = req.user?.role === 'admin'
    ? workspaces.listWorkspaces()
    : (current ? [current] : []);
  res.json({ active: current, workspaces: list });
});

app.post('/api/workspaces', auth.requirePermission('workspaces', 'create', 'admin'), (req, res) => {
  const { id, name, reposRoot, outputDir, createStructure } = req.body || {};
  if (!reposRoot) {
    return res.status(400).json({ success: false, error: 'reposRoot is required' });
  }
  const workspace = workspaces.upsertWorkspace({
    id,
    name,
    reposRoot,
    outputDir,
    createStructure: createStructure === true
  });
  audit('workspaces.create', { id: workspace.id, name: workspace.name }, req);
  res.json({ success: true, workspace });
});

app.put('/api/workspaces/:id', auth.requirePermission('workspaces', 'update', 'admin'), (req, res) => {
  const { id } = req.params;
  const { name, reposRoot, outputDir, createStructure } = req.body || {};
  const workspace = workspaces.upsertWorkspace({
    id,
    name,
    reposRoot,
    outputDir,
    createStructure: createStructure === true
  });
  audit('workspaces.update', { id: workspace.id }, req);
  res.json({ success: true, workspace });
});

app.post('/api/workspaces/:id/default', auth.requirePermission('workspaces', 'update', 'admin'), (req, res) => {
  const { id } = req.params;
  const target = workspaces.getWorkspaceById(id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Workspace not found' });
  }
  const current = config.getConfig();
  const updated = config.updateConfig({
    workspaces: {
      ...(current.workspaces || {}),
      defaultId: id
    }
  });
  audit('workspaces.set_default', { id }, req);
  res.json({ success: true, workspace: target, config: updated });
});

app.delete('/api/workspaces/:id', auth.requirePermission('workspaces', 'delete', 'admin'), (req, res) => {
  const { id } = req.params;
  const result = workspaces.removeWorkspace(id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  audit('workspaces.delete', { id }, req);
  res.json({ success: true });
});

// ==========================================
// User Management API
// ==========================================

app.get('/api/users', auth.requirePermission('users', 'read', 'admin'), (req, res) => {
  res.json(authStore.listUsers());
});

app.post('/api/users', auth.requirePermission('users', 'create', 'admin'), (req, res) => {
  const { username, password, role, workspaceId } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }
  const user = authStore.createUser({
    username,
    password,
    role: role || 'viewer',
    workspaceId: workspaceId || null
  });
  if (!user) {
    return res.status(400).json({ success: false, error: 'User already exists' });
  }
  audit('users.create', { id: user.id, username: user.username, role: user.role }, req);
  res.json({ success: true, user });
});

app.put('/api/users/:id', auth.requirePermission('users', 'update', 'admin'), (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  if (updates.role === 'admin') {
    // ok
  } else if (updates.role && !['viewer', 'editor', 'admin'].includes(updates.role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  if (updates.disabled === true) {
    const target = authStore.findById(id);
    if (target?.role === 'admin' && authStore.countAdmins() <= 1) {
      return res.status(400).json({ success: false, error: 'Cannot disable the last admin' });
    }
  }

  const updated = authStore.updateUser(id, updates);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  audit('users.update', { id, username: updated.username, role: updated.role }, req);
  res.json({ success: true, user: updated });
});

app.delete('/api/users/:id', auth.requirePermission('users', 'delete', 'admin'), (req, res) => {
  const { id } = req.params;
  const target = authStore.findById(id);
  if (target?.role === 'admin' && authStore.countAdmins() <= 1) {
    return res.status(400).json({ success: false, error: 'Cannot delete the last admin' });
  }
  const success = authStore.deleteUser(id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  audit('users.delete', { id }, req);
  res.json({ success: true });
});

// ==========================================
// SCIM-lite Provisioning API
// ==========================================

function requireScimToken(req, res, next) {
  const currentConfig = config.getConfig();
  if (currentConfig.auth?.scim?.enabled !== true) {
    return res.status(404).json({ error: 'SCIM is disabled' });
  }
  const expected = currentConfig.auth?.scim?.token;
  if (!expected) {
    return res.status(403).json({ error: 'SCIM token not configured' });
  }
  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : (req.headers['x-scim-token'] || null);
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.get('/api/scim/users', requireScimToken, (req, res) => {
  res.json({ users: authStore.listUsers() });
});

app.post('/api/scim/users', requireScimToken, (req, res) => {
  const { username, role, workspaceId, active } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  const created = authStore.upsertExternalUser({
    username,
    role: role || 'viewer',
    workspaceId: workspaceId || null,
    provider: 'scim'
  });
  if (!created) {
    return res.status(500).json({ error: 'Failed to create user' });
  }
  if (active === false) {
    authStore.updateUser(created.id, { disabled: true });
  }
  audit('scim.user.create', { id: created.id, username }, req);
  res.json({ success: true, user: created });
});

app.put('/api/scim/users/:id', requireScimToken, (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  const updated = authStore.updateUser(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  audit('scim.user.update', { id }, req);
  res.json({ success: true, user: updated });
});

app.patch('/api/scim/users/:id', requireScimToken, (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  const updated = authStore.updateUser(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  audit('scim.user.update', { id }, req);
  res.json({ success: true, user: updated });
});

app.delete('/api/scim/users/:id', requireScimToken, (req, res) => {
  const { id } = req.params;
  const success = authStore.deleteUser(id);
  if (!success) {
    return res.status(404).json({ error: 'User not found' });
  }
  audit('scim.user.delete', { id }, req);
  res.json({ success: true });
});

// Complete first-run setup
app.post('/api/setup', auth.requirePermission('config', 'update', 'admin'), (req, res) => {
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
    audit('setup.complete', { reposRoot, createdDirs }, req);
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
app.post('/api/validate-path', auth.requirePermission('system', 'read', 'viewer'), (req, res) => {
  const { path: pathToValidate } = req.body;

  if (!pathToValidate) {
    return res.status(400).json({ success: false, error: 'Path is required' });
  }

  const validation = config.validateReposRoot(pathToValidate);
  res.json(validation);
});

// LLM connectivity check (advisory)
app.post('/api/llm/ping', auth.requirePermission('llm', 'test', 'viewer'), async (req, res) => {
  const { endpoint, model, provider } = req.body || {};
  const llmConfig = config.getConfig().llm || {};
  const target = endpoint || llmConfig.endpoint;
  const selectedModel = model || llmConfig.model || 'gpt-3.5-turbo';
  const selectedProvider = provider || llmConfig.provider;

  if (!target) {
    return res.status(400).json({ success: false, reachable: false, error: 'Endpoint is required' });
  }
  if (llmConfig.allowRemote === false && !isLocalEndpoint(target)) {
    return res.status(403).json({
      success: false,
      reachable: false,
      error: 'Remote LLM endpoints are disabled'
    });
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
app.get('/api/default-paths', auth.requirePermission('system', 'read', 'viewer'), (req, res) => {
  res.json({
    reposRoot: config.getDefaultReposRoot(),
    outputDir: config.getDefaultOutputDir()
  });
});

// Browse directories - returns list of subdirectories at a given path
app.get('/api/browse', auth.requirePermission('system', 'read', 'viewer'), (req, res) => {
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

app.get('/api/status', auth.requirePermission('system', 'read', 'viewer'), (req, res) => {
  const currentConfig = config.getConfig();
  const workspace = workspaces.resolveWorkspace(req);
  res.json({
    status: 'Online',
    reposRoot: workspace?.reposRoot || currentConfig.reposRoot,
    workspaceId: workspace?.id || null,
    isFirstRun: config.isFirstRun(),
    gitAvailable: repoManager.isGitAvailable()
  });
});

app.get('/api/repos', auth.requirePermission('repos', 'read', 'viewer'), (req, res) => {
  try {
    const repos = repoManager.loadRegistry(req.workspace?.reposRoot);
    res.json(repos);
  } catch (e) {
    console.error('Repo read error:', e);
    res.status(500).json({ error: 'Failed to read registry' });
  }
});

app.get('/api/categories', auth.requirePermission('repos', 'read', 'viewer'), (req, res) => {
  try {
    const categories = repoManager.getCategories(req.workspace?.reposRoot);
    res.json(categories);
  } catch (e) {
    console.error('Categories read error:', e);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

app.get('/api/category-sizes', auth.requirePermission('repos', 'read', 'viewer'), async (req, res) => {
  try {
    const sizes = await repoManager.getCategorySizesAsync(req.workspace?.reposRoot);
    res.json(sizes);
  } catch (e) {
    console.error('Category size error:', e);
    res.status(500).json({ error: 'Failed to compute category sizes' });
  }
});

// Scan for repositories (cross-platform Node.js)
app.post('/api/scan', auth.requirePermission('repos', 'scan', 'editor'), (req, res) => {
  try {
    const results = repoManager.scanRepositories(req.workspace?.reposRoot, (msg) => {
      console.log(`[SCAN] ${msg}`);
    });

    audit('repos.scan', { found: results.found?.length || 0, newRepos: results.newRepos }, req);
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
app.post('/api/add', auth.requirePermission('repos', 'create', 'editor'), async (req, res) => {
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
    }, { reposRoot: req.workspace?.reposRoot });

    if (result.success) {
      audit('repos.clone', { name: result.repo?.name, category: result.repo?.category, source: trimmedUrl }, req);
      res.json({
        success: true,
        output: `Cloned ${result.repo.name} to ${result.repo.category}`,
        repo: result.repo
      });
    } else {
      audit('repos.clone_failed', { code: result.code, error: result.error, source: trimmedUrl }, req);
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
app.delete('/api/repos/:name', auth.requirePermission('repos', 'delete', 'admin'), (req, res) => {
  const { name } = req.params;
  const { deleteFiles } = req.query;

  const result = repoManager.removeRepository(name, deleteFiles === 'true', req.workspace?.reposRoot);

  if (result.success) {
    audit('repos.remove', { name, deleteFiles: deleteFiles === 'true' }, req);
    res.json(result);
  } else {
    audit('repos.remove_failed', { name, error: result.error }, req);
    res.status(400).json(result);
  }
});

// ==========================================
// Vector Index API
// ==========================================

app.get('/api/vector-index/status', auth.requirePermission('vector_index', 'read', 'viewer'), (req, res) => {
  res.json(vectorIndex.getStatus({ workspaceId: req.workspace?.id || null }));
});

app.post('/api/vector-index/rebuild', auth.requirePermission('vector_index', 'rebuild', 'editor'), async (req, res) => {
  const queueEnabled = config.getConfig().queue?.enabled === true;
  if (queueEnabled) {
    const job = jobQueue.enqueueJob({
      type: 'vector-index',
      payload: {
        workspaceId: req.workspace?.id || null,
        reposRoot: req.workspace?.reposRoot || null
      },
      createdBy: req.user?.username || null,
      workspaceId: req.workspace?.id || null
    });
    audit('vectorIndex.rebuild.queued', { jobId: job.id }, req);
    return res.json({ success: true, queued: true, job });
  }
  const summary = await vectorIndex.rebuildIndex({ workspaceId: req.workspace?.id || null, reposRoot: req.workspace?.reposRoot || null });
  audit('vectorIndex.rebuild', { docCount: summary?.docCount }, req);
  res.json({ success: true, summary });
});

// Update a repository
app.post('/api/repos/:name/update', auth.requirePermission('repos', 'update', 'editor'), (req, res) => {
  const { name } = req.params;
  const result = repoManager.updateRepository(name, req.workspace?.reposRoot);

  if (result.success) {
    audit('repos.update', { name }, req);
    res.json(result);
  } else {
    audit('repos.update_failed', { name, error: result.error }, req);
    res.status(400).json(result);
  }
});

// ==========================================
// Orchestrator API
// ==========================================

app.post('/api/spawn', auth.requirePermission('runs', 'create', 'editor'), (req, res) => {
  const { goal, format, async: asyncMode } = req.body;
  if (!goal) {
    return res.status(400).json({ error: 'Goal required' });
  }

  const orchestratorPath = path.join(__dirname, 'orchestrator.js');
  const allowedFormats = new Set(['universal', 'chatgpt', 'claude', 'gemini']);
  const normalizedFormat = allowedFormats.has((format || '').toLowerCase())
    ? format.toLowerCase()
    : 'universal';

  console.log(`[ORCHESTRATOR] Spawning: ${goal} (format: ${normalizedFormat})`);
  audit('spawn.start', { format: normalizedFormat, goal }, req);

  const queueEnabled = config.getConfig().queue?.enabled === true;
  if (asyncMode === true && queueEnabled === true) {
    const job = jobQueue.enqueueJob({
      type: 'spawn',
      payload: {
        goal,
        format: normalizedFormat,
        workspaceId: req.workspace?.id || null,
        reposRoot: req.workspace?.reposRoot || null,
        outputDir: req.workspace?.outputDir || null
      },
      createdBy: req.user?.username || null,
      workspaceId: req.workspace?.id || null
    });
    return res.json({ success: true, queued: true, job });
  }

  // Use spawn with array arguments (cross-platform safe)
  const child = spawn('node', [orchestratorPath, goal, normalizedFormat], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      REPOS_ROOT: req.workspace?.reposRoot || config.getConfig().reposRoot,
      CORTEX_OUTPUT_DIR: req.workspace?.outputDir || config.getConfig().outputDir,
      CORTEX_WORKSPACE_ID: req.workspace?.id || null
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
      audit('spawn.failed', { format: normalizedFormat, goal, code }, req);
      return res.status(500).json({
        success: false,
        error: `Orchestrator exited with code ${code}`,
        output: stdout + stderr
      });
    }

    audit('spawn.complete', { format: normalizedFormat, goal }, req);

    // Record analytics
    config.recordSpawn(goal, 'std-agent', 0, req.workspace?.id || null);

    res.json({ success: true, output: stdout });
  });
});

// ==========================================
// Analytics API
// ==========================================

app.get('/api/analytics', auth.requirePermission('analytics', 'read', 'viewer'), (req, res) => {
  const analytics = config.getAnalytics(req.workspace?.id || null);
  res.json(analytics);
});

// ==========================================
// Audit Log API
// ==========================================

app.get('/api/audit', auth.requirePermission('audit', 'read', 'viewer'), (req, res) => {
  const limit = Number(req.query.limit) || 200;
  const event = req.query.event || null;
  const entries = readAuditEntries({
    limit,
    workspaceId: req.workspace?.id || null,
    event
  });
  res.json(entries);
});

app.get('/api/audit/export', auth.requirePermission('audit', 'export', 'viewer'), (req, res) => {
  const format = (req.query.format || 'json').toString().toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 1000, 5000);
  const event = req.query.event || null;
  const entries = readAuditEntries({
    limit,
    workspaceId: req.workspace?.id || null,
    event
  });

  audit('audit.export', { format, count: entries.length }, req);

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    const csv = formatAuditCsv(entries);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cortex-audit-${stamp}.csv"`);
    return res.send(csv);
  }

  res.setHeader('Content-Disposition', `attachment; filename="cortex-audit-${stamp}.json"`);
  return res.json({ entries });
});

// ==========================================
// Session History API (for P1: Session Persistence)
// ==========================================

const SESSIONS_FILE = path.join(__dirname, '..', 'sessions.json');

function loadSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) return [];
  const data = readJsonFile(SESSIONS_FILE, []);
  return Array.isArray(data) ? data : [];
}

function saveSessions(sessions) {
  writeJsonAtomic(SESSIONS_FILE, sessions);
}

app.get('/api/sessions', auth.requirePermission('sessions', 'read', 'viewer'), (req, res) => {
  const sessions = loadSessions();
  const workspaceId = req.workspace?.id || null;
  const filtered = sessions.filter((session) => matchesWorkspace(session, workspaceId));
  res.json(filtered.slice(-20).reverse()); // Last 20, newest first
});

app.post('/api/sessions', auth.requirePermission('sessions', 'create', 'editor'), (req, res) => {
  const { goal, agent, resources, output } = req.body;

  const sessions = loadSessions();
  const session = {
    id: `session-${Date.now()}`,
    timestamp: new Date().toISOString(),
    workspaceId: req.workspace?.id || null,
    goal,
    agent,
    resources,
    outputPreview: output ? output.substring(0, 500) : null
  };

  sessions.push(session);

  // Keep only last 50 sessions
  const trimmed = sessions.slice(-50);
  saveSessions(trimmed);
  audit('sessions.create', { id: session.id }, req);

  res.json({ success: true, session });
});

// ==========================================
// Runs & Observability API
// ==========================================

app.get('/api/runs', auth.requirePermission('runs', 'read', 'viewer'), (req, res) => {
  const workspaceId = req.workspace?.id || null;
  const runs = runsStore.loadRuns().filter((run) => matchesWorkspace(run, workspaceId));
  const limit = Number(req.query.limit);
  if (!Number.isNaN(limit) && limit > 0) {
    return res.json(runs.slice(0, limit));
  }
  res.json(runs);
});

app.get('/api/runs/:id', auth.requirePermission('runs', 'read', 'viewer'), (req, res) => {
  const run = runsStore.getRun(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  if (!matchesWorkspace(run, req.workspace?.id || null)) {
    return res.status(404).json({ error: 'Run not found' });
  }
  res.json(run);
});

app.get('/api/observability/summary', auth.requirePermission('observability', 'read', 'viewer'), (req, res) => {
  res.json(summarizeObservability(req.workspace?.id || null));
});

app.get('/api/observability/metrics', auth.requirePermission('observability', 'read', 'viewer'), (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    uptimeSec: Math.round(process.uptime()),
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal
    },
    cpu: {
      loadAvg: os.loadavg(),
      cores: os.cpus().length
    },
    queue: jobQueue.getQueueStats(),
    vectorIndex: vectorIndex.getStatus({ workspaceId: req.workspace?.id || null }),
    workspace: req.workspace?.id || null
  });
});

// ==========================================
// Job Queue API
// ==========================================

app.get('/api/jobs', auth.requirePermission('jobs', 'read', 'viewer'), (req, res) => {
  const workspaceId = req.workspace?.id || null;
  const jobs = jobQueue.listJobs().filter((job) => matchesWorkspace(job, workspaceId));
  res.json(jobs);
});

app.get('/api/jobs/:id', auth.requirePermission('jobs', 'read', 'viewer'), (req, res) => {
  const job = jobQueue.getJob(req.params.id);
  if (!job || !matchesWorkspace(job, req.workspace?.id || null)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

app.post('/api/jobs/:id/cancel', auth.requirePermission('jobs', 'update', 'editor'), (req, res) => {
  const job = jobQueue.cancelJob(req.params.id);
  if (!job || !matchesWorkspace(job, req.workspace?.id || null)) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.json({ success: true, job });
});

app.post('/api/jobs', auth.requirePermission('jobs', 'create', 'editor'), (req, res) => {
  const { type, payload } = req.body || {};
  if (!type) {
    return res.status(400).json({ success: false, error: 'Job type required' });
  }
  const job = jobQueue.enqueueJob({
    type,
    payload: {
      ...(payload || {}),
      workspaceId: req.workspace?.id || null,
      reposRoot: req.workspace?.reposRoot || null,
      outputDir: req.workspace?.outputDir || null
    },
    createdBy: req.user?.username || null,
    workspaceId: req.workspace?.id || null
  });
  audit('jobs.create', { id: job.id, type }, req);
  res.json({ success: true, job });
});

// ==========================================
// Agents Registry API
// ==========================================

app.get('/api/agents', auth.requirePermission('agents', 'read', 'viewer'), (req, res) => {
  const currentConfig = config.getConfig();
  const agentsDir = path.join(req.workspace?.reposRoot || currentConfig.reposRoot, 'agents');

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

app.get('/api/datasets', auth.requirePermission('datasets', 'read', 'viewer'), (req, res) => {
  const datasets = datasetsStore.loadDatasets();
  const workspaceId = req.workspace?.id || null;
  res.json(datasets.filter((dataset) => matchesWorkspace(dataset, workspaceId)));
});

app.get('/api/datasets/:id', auth.requirePermission('datasets', 'read', 'viewer'), (req, res) => {
  const dataset = datasetsStore.getDataset(req.params.id);
  if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  res.json(dataset);
});

app.get('/api/datasets/:id/export', auth.requirePermission('datasets', 'export', 'viewer'), (req, res) => {
  const dataset = datasetsStore.getDataset(req.params.id);
  if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  const safeName = (dataset.name || 'dataset').replace(/[^a-z0-9-_]+/gi, '_');
  audit('datasets.export', { id: dataset.id, name: dataset.name }, req);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`);
  res.json({ dataset });
});

app.post('/api/datasets', auth.requirePermission('datasets', 'create', 'editor'), (req, res) => {
  const { name, description, benchmarkType } = req.body || {};
  if (!name) {
    return res.status(400).json({ success: false, error: 'Dataset name is required' });
  }
  const dataset = datasetsStore.createDataset({
    name,
    description,
    benchmarkType: benchmarkType || 'response',
    workspaceId: req.workspace?.id || null
  });
  audit('datasets.create', { id: dataset.id, name: dataset.name }, req);
  res.json({ success: true, dataset });
});

app.post('/api/datasets/import', auth.requirePermission('datasets', 'import', 'editor'), (req, res) => {
  const payload = req.body?.dataset || req.body;
  if (!payload || !payload.name) {
    return res.status(400).json({ success: false, error: 'Dataset payload with name is required' });
  }

  const dataset = datasetsStore.importDataset(payload, req.workspace?.id || null);
  if (!dataset) {
    return res.status(500).json({ success: false, error: 'Failed to import dataset' });
  }
  audit('datasets.import', { id: dataset.id, name: dataset.name }, req);
  res.json({ success: true, dataset });
});

app.put('/api/datasets/:id', auth.requirePermission('datasets', 'update', 'editor'), (req, res) => {
  const { name, description, benchmarkType } = req.body || {};
  const existing = datasetsStore.getDataset(req.params.id);
  if (!existing || !matchesWorkspace(existing, req.workspace?.id || null)) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  const updated = datasetsStore.updateDataset(req.params.id, { name, description, benchmarkType });
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  audit('datasets.update', { id: updated.id, name: updated.name }, req);
  res.json({ success: true, dataset: updated });
});

app.delete('/api/datasets/:id', auth.requirePermission('datasets', 'delete', 'editor'), (req, res) => {
  const existing = datasetsStore.getDataset(req.params.id);
  if (!existing || !matchesWorkspace(existing, req.workspace?.id || null)) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  const success = datasetsStore.deleteDataset(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  audit('datasets.delete', { id: req.params.id }, req);
  res.json({ success: true });
});

app.post('/api/datasets/:id/items', auth.requirePermission('datasets', 'update', 'editor'), (req, res) => {
  const { input, expected, tags, weight, expectedType, rubric, expectedPaths } = req.body || {};
  if (!input) {
    return res.status(400).json({ success: false, error: 'Item input is required' });
  }
  const dataset = datasetsStore.getDataset(req.params.id);
  if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  const item = datasetsStore.addDatasetItem(req.params.id, { input, expected, tags, weight, expectedType, rubric, expectedPaths });
  if (!item) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  audit('datasets.item.add', { datasetId: req.params.id, itemId: item.id }, req);
  res.json({ success: true, item });
});

app.delete('/api/datasets/:id/items/:itemId', auth.requirePermission('datasets', 'update', 'editor'), (req, res) => {
  const dataset = datasetsStore.getDataset(req.params.id);
  if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  const success = datasetsStore.removeDatasetItem(req.params.id, req.params.itemId);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }
  audit('datasets.item.remove', { datasetId: req.params.id, itemId: req.params.itemId }, req);
  res.json({ success: true });
});

app.get('/api/evaluations', auth.requirePermission('evaluations', 'read', 'viewer'), (req, res) => {
  const evaluations = evaluationsStore.loadEvaluations();
  const workspaceId = req.workspace?.id || null;
  res.json(evaluations.filter((evaluation) => matchesWorkspace(evaluation, workspaceId)));
});

app.get('/api/evaluation-templates', auth.requirePermission('evaluation_templates', 'read', 'viewer'), (req, res) => {
  res.json(evaluationTemplatesStore.loadTemplates());
});

app.get('/api/evaluation-templates/export', auth.requirePermission('evaluation_templates', 'export', 'viewer'), (req, res) => {
  const templates = evaluationTemplatesStore.loadTemplates();
  res.json({ templates });
});

app.post('/api/evaluation-templates/import', auth.requirePermission('evaluation_templates', 'import', 'editor'), (req, res) => {
  const payload = req.body?.templates || req.body?.template || req.body;
  const created = evaluationTemplatesStore.importTemplates(payload);
  audit('evaluationTemplates.import', { count: created.length }, req);
  res.json({ success: true, templates: created });
});

app.post('/api/evaluation-templates', auth.requirePermission('evaluation_templates', 'create', 'editor'), (req, res) => {
  const { name, description, rubric, expectedType } = req.body || {};
  if (!name) {
    return res.status(400).json({ success: false, error: 'Template name is required' });
  }
  const template = evaluationTemplatesStore.createTemplate({ name, description, rubric, expectedType });
  audit('evaluationTemplates.create', { id: template.id, name: template.name }, req);
  res.json({ success: true, template });
});

app.put('/api/evaluation-templates/:id', auth.requirePermission('evaluation_templates', 'update', 'editor'), (req, res) => {
  const updated = evaluationTemplatesStore.updateTemplate(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }
  audit('evaluationTemplates.update', { id: updated.id, name: updated.name }, req);
  res.json({ success: true, template: updated });
});

app.delete('/api/evaluation-templates/:id', auth.requirePermission('evaluation_templates', 'delete', 'editor'), (req, res) => {
  const success = evaluationTemplatesStore.deleteTemplate(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }
  audit('evaluationTemplates.delete', { id: req.params.id }, req);
  res.json({ success: true });
});

app.post('/api/evaluations', auth.requirePermission('evaluations', 'create', 'editor'), async (req, res) => {
  const { datasetId, runId, name } = req.body || {};
  if (!datasetId) {
    return res.status(400).json({ success: false, error: 'datasetId is required' });
  }

  const dataset = datasetsStore.getDataset(datasetId);
  const run = runId ? runsStore.getRun(runId) : null;
  if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
    return res.status(404).json({ success: false, error: 'Dataset not found' });
  }
  const isRetrievalBenchmark = dataset.benchmarkType === 'retrieval';
  if (!isRetrievalBenchmark) {
    if (!runId) {
      return res.status(400).json({ success: false, error: 'runId is required for response evaluations' });
    }
    if (!run || !matchesWorkspace(run, req.workspace?.id || null)) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
  }

  const fullConfig = config.getConfig();
  const evaluationConfig = fullConfig.evaluation || {};
  const llmConfig = fullConfig.llm || {};
  const decisionConfig = fullConfig.decisionMatrix || {};
  if (isRetrievalBenchmark) {
    const benchmarkTopK = evaluationConfig.benchmarkTopK ?? 5;
    const benchmark = await runRetrievalBenchmark({
      dataset,
      reposRoot: req.workspace?.reposRoot || fullConfig.reposRoot,
      decisionConfig,
      vectorConfig: fullConfig.vectorIndex || {},
      workspaceId: req.workspace?.id || null,
      topK: benchmarkTopK
    });

    const passThreshold = evaluationConfig.passThreshold ?? 0.75;
    const warnThreshold = evaluationConfig.warnThreshold ?? 0.6;
    const passRate = benchmark.metrics.recallAtK;
    let status = 'needs-review';
    if (benchmark.metrics.scoredCount > 0) {
      if (passRate >= passThreshold) status = 'pass';
      else if (passRate >= warnThreshold) status = 'warn';
      else status = 'fail';
    }

    const evaluation = {
      id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name || `${dataset.name} • Retrieval benchmark`,
      type: 'retrieval',
      datasetId,
      datasetName: dataset.name,
      datasetVersion: dataset.version || 1,
      datasetUpdatedAt: dataset.updatedAt || dataset.createdAt,
      runId: null,
      runGoal: null,
      createdAt: new Date().toISOString(),
      workspaceId: req.workspace?.id || null,
      status,
      metrics: {
        ...benchmark.metrics,
        passRate,
        status
      },
      usage: {
        tokensEstimated: 0,
        costEstimated: 0,
        currency: llmConfig.currency || 'USD',
        llmCalls: 0
      },
      items: benchmark.items
    };

    evaluationsStore.recordEvaluation(evaluation);
    audit('evaluations.create', { id: evaluation.id, datasetId }, req);
    return res.json({ success: true, evaluation });
  }

  const maxChars = evaluationConfig.maxOutputChars ?? 120000;
  const output = readRunOutput(run, maxChars);
  const llmEnabled = evaluationConfig.llmGraderEnabled !== false && llmConfig.enabled === true;
  const maxLlmItems = evaluationConfig.llmMaxItems ?? 12;
  let llmUsedCount = 0;
  let llmTokensEstimated = 0;
  const items = [];

  for (const item of (dataset.items || [])) {
    const wantsLlm = item.expectedType === 'llm' || Boolean(item.rubric);
    if (llmEnabled && wantsLlm && llmUsedCount < maxLlmItems) {
      const graded = await gradeItemWithLlm({ run, item, output, llmConfig, decisionConfig });
      if (graded.used) {
        llmUsedCount += 1;
        const outputSnippet = output.length > 2000 ? output.slice(0, 2000) : output;
        llmTokensEstimated += estimateTokens(
          `${run.goal}\n${item.input}\n${item.expected || ''}\n${item.rubric || ''}\n${outputSnippet}`
        );
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
    needsReviewCount: summary.needsReviewCount,
    llmCalls: llmUsedCount
  };
  const llmCostEstimated = estimateCost(llmTokensEstimated, llmConfig);
  const evaluation = {
    id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || `${dataset.name} • ${new Date().toLocaleDateString()}`,
    type: 'response',
    datasetId,
    datasetName: dataset.name,
    datasetVersion: dataset.version || 1,
    datasetUpdatedAt: dataset.updatedAt || dataset.createdAt,
    runId,
    runGoal: run.goal,
    createdAt: new Date().toISOString(),
    workspaceId: req.workspace?.id || null,
    status: summary.status,
    metrics,
    usage: {
      tokensEstimated: llmTokensEstimated,
      costEstimated: llmCostEstimated,
      currency: llmConfig.currency || 'USD',
      llmCalls: llmUsedCount
    },
    items
  };

  evaluationsStore.recordEvaluation(evaluation);
  audit('evaluations.create', { id: evaluation.id, datasetId, runId }, req);
  res.json({ success: true, evaluation });
});

app.get('/api/evaluations/compare', auth.requirePermission('evaluations', 'compare', 'viewer'), (req, res) => {
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
  if (!matchesWorkspace(left, req.workspace?.id || null) || !matchesWorkspace(right, req.workspace?.id || null)) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }

  const delta = {
    score: (right.metrics?.score ?? 0) - (left.metrics?.score ?? 0),
    passRate: (right.metrics?.passRate ?? 0) - (left.metrics?.passRate ?? 0),
    itemCount: (right.metrics?.itemCount ?? 0) - (left.metrics?.itemCount ?? 0)
  };

  audit('evaluations.compare', { leftId, rightId }, req);
  res.json({
    left,
    right,
    delta,
    meta: {
      datasetMismatch: left.datasetId !== right.datasetId,
      datasetVersionMismatch: left.datasetVersion !== right.datasetVersion
    }
  });
});

// ==========================================
// Saved Prompts API
// ==========================================

// Get all saved prompts
app.get('/api/prompts', auth.requirePermission('prompts', 'read', 'viewer'), (req, res) => {
  const prompts = config.getSavedPrompts(req.workspace?.id || null);
  res.json(prompts);
});

// Save a new prompt
app.post('/api/prompts', auth.requirePermission('prompts', 'create', 'editor'), (req, res) => {
  const { title, query } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  const prompt = config.savePrompt(title, query, req.workspace?.id || null);
  audit('prompts.save', { id: prompt.id, title: prompt.title }, req);
  res.json({ success: true, prompt });
});

// Update a prompt
app.put('/api/prompts/:id', auth.requirePermission('prompts', 'update', 'editor'), (req, res) => {
  const { id } = req.params;
  const { title, query } = req.body;

  const existing = config.getSavedPrompts(req.workspace?.id || null).find(p => p.id === id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Prompt not found' });
  }
  const prompt = config.updatePrompt(id, { title, query });

  if (prompt) {
    audit('prompts.update', { id: prompt.id, title: prompt.title }, req);
    res.json({ success: true, prompt });
  } else {
    res.status(404).json({ success: false, error: 'Prompt not found' });
  }
});

// Delete a prompt
app.delete('/api/prompts/:id', auth.requirePermission('prompts', 'delete', 'editor'), (req, res) => {
  const { id } = req.params;

  const existing = config.getSavedPrompts(req.workspace?.id || null).find(p => p.id === id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Prompt not found' });
  }
  const success = config.deletePrompt(id);

  if (success) {
    audit('prompts.delete', { id }, req);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Prompt not found' });
  }
});

// ==========================================
// Tools Registry API (for P1: Tools Registry)
// ==========================================

app.get('/api/tools', auth.requirePermission('tools', 'read', 'viewer'), (req, res) => {
  const currentConfig = config.getConfig();
  const toolsDir = path.join(req.workspace?.reposRoot || currentConfig.reposRoot, 'tools');

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

// Kick off any queued jobs on startup
jobQueue.processQueue();
jobQueue.ensureWorkerPool();
