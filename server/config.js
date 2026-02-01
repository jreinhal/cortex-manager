/**
 * CORTEX Configuration Manager
 * Cross-platform configuration with first-run detection
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Config file location (in project root)
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  reposRoot: null, // Will be set during first-run
  outputDir: null, // Defaults to project root if null
  firstRunComplete: false,
  theme: 'dark',
  pollingInterval: 10000,
  maxRecentSpawns: 20,
  filePreviewLength: 2000,
  // Analytics
  analytics: {
    enabled: true,
    spawns: [],
    lastReset: null
  }
};

/**
 * Get default repos root based on OS
 */
function getDefaultReposRoot() {
  const home = os.homedir();

  switch (process.platform) {
    case 'win32':
      // Windows: Check common locations
      const windowsPaths = [
        path.join(home, 'Projects', 'reference-repos'),
        path.join(home, 'Documents', 'reference-repos'),
        path.join('C:', 'Projects', 'reference-repos')
      ];
      for (const p of windowsPaths) {
        if (fs.existsSync(p)) return p;
      }
      return path.join(home, 'Projects', 'reference-repos');

    case 'darwin':
      // macOS
      return path.join(home, 'Projects', 'reference-repos');

    case 'linux':
      // Linux
      return path.join(home, 'projects', 'reference-repos');

    default:
      return path.join(home, 'reference-repos');
  }
}

/**
 * Get default output directory
 */
function getDefaultOutputDir() {
  return path.join(__dirname, '..', 'spawned_agents');
}

/**
 * Load configuration from file
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      const loaded = JSON.parse(data);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_CONFIG, ...loaded };
    }
  } catch (e) {
    console.error('Error loading config:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  try {
    const data = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_PATH, data, 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving config:', e.message);
    return false;
  }
}

/**
 * Get current configuration
 * Respects environment variables as overrides
 */
function getConfig() {
  const config = loadConfig();

  // Environment variable overrides
  if (process.env.REPOS_ROOT) {
    config.reposRoot = process.env.REPOS_ROOT;
  }
  if (process.env.CORTEX_OUTPUT_DIR) {
    config.outputDir = process.env.CORTEX_OUTPUT_DIR;
  }

  // Apply defaults if not set
  if (!config.reposRoot) {
    config.reposRoot = getDefaultReposRoot();
  }
  if (!config.outputDir) {
    config.outputDir = getDefaultOutputDir();
  }

  return config;
}

/**
 * Update configuration
 */
function updateConfig(updates) {
  const config = loadConfig();
  const newConfig = { ...config, ...updates };
  return saveConfig(newConfig) ? newConfig : null;
}

/**
 * Check if first run is needed
 */
function isFirstRun() {
  const config = loadConfig();
  return !config.firstRunComplete;
}

/**
 * Complete first run setup
 */
function completeFirstRun(reposRoot) {
  const config = loadConfig();
  config.reposRoot = reposRoot;
  config.firstRunComplete = true;
  config.setupDate = new Date().toISOString();
  return saveConfig(config);
}

/**
 * Ensure directory exists (cross-platform)
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Create standard directory structure
 */
function createDirectoryStructure(reposRoot) {
  const directories = [
    'agents',
    'skills',
    'knowledge',
    'tools',
    'benchmarks',
    '_system'
  ];

  const created = [];
  for (const dir of directories) {
    const fullPath = path.join(reposRoot, dir);
    if (ensureDir(fullPath)) {
      created.push(dir);
    }
  }

  // Create empty repos.json if it doesn't exist
  const registryPath = path.join(reposRoot, '_system', 'repos.json');
  if (!fs.existsSync(registryPath)) {
    fs.writeFileSync(registryPath, '[]', 'utf8');
  }

  return created;
}

/**
 * Validate repos root path
 */
function validateReposRoot(reposPath) {
  const errors = [];

  // Check if path is absolute
  if (!path.isAbsolute(reposPath)) {
    errors.push('Path must be absolute');
  }

  // Check if parent directory exists (for creation)
  const parent = path.dirname(reposPath);
  if (!fs.existsSync(parent)) {
    errors.push(`Parent directory does not exist: ${parent}`);
  }

  // Check write permissions on parent
  try {
    fs.accessSync(parent, fs.constants.W_OK);
  } catch {
    errors.push(`No write permission for: ${parent}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    exists: fs.existsSync(reposPath),
    hasStructure: fs.existsSync(path.join(reposPath, '_system', 'repos.json'))
  };
}

/**
 * Get system info for debugging
 */
function getSystemInfo() {
  return {
    platform: process.platform,
    arch: os.arch(),
    nodeVersion: process.version,
    homeDir: os.homedir(),
    configPath: CONFIG_PATH,
    cwd: process.cwd()
  };
}

// Analytics helpers
function recordSpawn(goal, agent, resourceCount) {
  const config = loadConfig();
  if (!config.analytics) {
    config.analytics = { enabled: true, spawns: [], lastReset: null };
  }

  config.analytics.spawns.push({
    timestamp: new Date().toISOString(),
    goal: goal.substring(0, 100), // Truncate for storage
    agent,
    resourceCount
  });

  // Keep only last 100 spawns
  if (config.analytics.spawns.length > 100) {
    config.analytics.spawns = config.analytics.spawns.slice(-100);
  }

  saveConfig(config);
}

function getAnalytics() {
  const config = loadConfig();
  const spawns = config.analytics?.spawns || [];

  // Calculate stats
  const now = new Date();
  const thisMonth = spawns.filter(s => {
    const d = new Date(s.timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Agent usage
  const agentCounts = {};
  spawns.forEach(s => {
    agentCounts[s.agent] = (agentCounts[s.agent] || 0) + 1;
  });

  const topAgent = Object.entries(agentCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalSpawns: spawns.length,
    thisMonthSpawns: thisMonth.length,
    topAgent: topAgent ? { name: topAgent[0], count: topAgent[1] } : null,
    avgResourcesPerSpawn: spawns.length > 0
      ? Math.round(spawns.reduce((a, s) => a + (s.resourceCount || 0), 0) / spawns.length)
      : 0,
    recentSpawns: spawns.slice(-10).reverse()
  };
}

module.exports = {
  getConfig,
  updateConfig,
  loadConfig,
  saveConfig,
  isFirstRun,
  completeFirstRun,
  ensureDir,
  createDirectoryStructure,
  validateReposRoot,
  getDefaultReposRoot,
  getDefaultOutputDir,
  getSystemInfo,
  recordSpawn,
  getAnalytics,
  CONFIG_PATH
};
