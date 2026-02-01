const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Import new modules
const config = require('./config');
const repoManager = require('./repo-manager');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Get current configuration
const appConfig = config.getConfig();

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

  // Validate reposRoot if provided
  if (updates.reposRoot) {
    const validation = config.validateReposRoot(updates.reposRoot);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid repos root path',
        details: validation.errors
      });
    }
  }

  const newConfig = config.updateConfig(updates);
  if (newConfig) {
    res.json({ success: true, config: newConfig });
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

  // Validate path
  const validation = config.validateReposRoot(reposRoot);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid path',
      details: validation.errors
    });
  }

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
      createdDirectories: createdDirs
    });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
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

// Get default paths suggestion
app.get('/api/default-paths', (req, res) => {
  res.json({
    reposRoot: config.getDefaultReposRoot(),
    outputDir: config.getDefaultOutputDir()
  });
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

  try {
    const result = await repoManager.cloneRepository(url, (msg) => {
      console.log(`[CLONE] ${msg}`);
    });

    if (result.success) {
      res.json({
        success: true,
        output: `Cloned ${result.repo.name} to ${result.repo.category}`,
        repo: result.repo
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
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
  const { goal } = req.body;
  if (!goal) {
    return res.status(400).json({ error: 'Goal required' });
  }

  const orchestratorPath = path.join(__dirname, 'orchestrator.js');

  console.log(`[ORCHESTRATOR] Spawning: ${goal}`);

  // Use spawn with array arguments (cross-platform safe)
  const child = spawn('node', [orchestratorPath, goal], {
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
