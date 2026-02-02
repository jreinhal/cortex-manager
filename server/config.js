/**
 * CORTEX Configuration Manager
 * Cross-platform configuration with first-run detection
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Config file location (in project root)
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const PROMPTS_PATH = path.join(__dirname, '..', 'saved_prompts.json');

// Default configuration
const DEFAULT_CONFIG = {
  reposRoot: null, // Will be set during first-run
  outputDir: null, // Defaults to project root if null
  firstRunComplete: false,
  theme: 'dark',
  pollingInterval: 10000,
  maxRecentSpawns: 20,
  filePreviewLength: 2000,
  decisionMatrix: {
    agentsMdPriority: true,
    lowConfidenceThreshold: 0.4,
    ambiguityGap: 15,
    rerankGap: 0.12,
    maxCandidates: 8,
    requireDDrive: process.platform === 'win32',
    queryExpansion: {
      maxVariants: 4
    },
    routing: {
      minKeywordCount: 2,
      highRecallKeywordCount: 6,
      noResourceKeywordCount: 0,
      lowConfidenceThreshold: 0.35
    },
    retrievalGate: {
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
    },
    uncertainty: {
      requiresReviewThreshold: 0.6,
      highComplexityPenalty: 0.1,
      lowKeywordPenalty: 0.2,
      lowTechPenalty: 0.12,
      shortGoalPenalty: 0.08,
      minKeywordCount: 2
    },
    ragFusion: {
      enabled: true,
      k: 60,
      weight: 0.5,
      includeOriginal: true,
      maxVariants: 4
    },
    hyde: {
      enabled: true,
      mode: 'fallback',
      minResults: 2,
      minScore: 0.3
    },
    hybridRetrieval: {
      enabled: true,
      semanticWeight: 0.35,
      minSemanticScore: 0.05
    },
    lateInteraction: {
      enabled: true,
      topK: 8,
      weight: 0.35,
      minScore: 0.15
    },
    llmRerank: {
      mode: 'lowConfidence',
      minUncertainty: 0.55,
      minTopScore: 0.32,
      minResourceCount: 3,
      allowWhenAmbiguous: true,
      allowWhenLowConfidence: true
    },
    performance: {
      slowRunMs: 20000
    },
    rrf: {
      enabled: true,
      k: 60,
      weight: 0.45
    }
  },
  llm: {
    enabled: true,
    provider: 'openai-compatible',
    model: 'qwen2.5-14b-instruct-q4',
    endpoint: 'http://localhost:8080/v1/chat/completions',
    fallbackEndpoint: null,
    allowRemote: true,
    modelDir: null,
    modelPath: null,
    timeoutMs: 10000,
    temperature: 0.1,
    maxTokens: 400,
    topN: 6
  },
  evaluation: {
    passThreshold: 0.75,
    warnThreshold: 0.6,
    maxOutputChars: 120000,
    llmGraderEnabled: true,
    llmMaxItems: 12
  },
  // Analytics
  analytics: {
    enabled: true,
    spawns: [],
    lastReset: null
  },
  // Saved prompts/queries
  savedPrompts: []
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
        path.join('D:', 'Projects', 'reference-repos'),
        path.join('D:', 'reference-repos'),
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
 * Get default local model directory
 */
function getDefaultModelDir() {
  if (process.platform === 'win32') {
    const windowsPaths = [
      path.join('D:', 'Models', 'qwen2.5-14b-instruct-q4'),
      path.join('D:', 'Models'),
      path.join(os.homedir(), 'Models')
    ];
    for (const p of windowsPaths) {
      if (fs.existsSync(p)) return p;
    }
    return path.join('D:', 'Models', 'qwen2.5-14b-instruct-q4');
  }

  return path.join(os.homedir(), 'models', 'qwen2.5-14b-instruct-q4');
}

function hasReposStructure(candidate) {
  if (!candidate || !fs.existsSync(candidate)) return false;
  const registry = path.join(candidate, '_system', 'repos.json');
  if (fs.existsSync(registry)) return true;

  const categories = ['agents', 'skills', 'knowledge', 'tools', 'benchmarks'];
  return categories.some((dir) => fs.existsSync(path.join(candidate, dir)));
}

function getRepoCandidateScore(candidate) {
  if (!candidate || !fs.existsSync(candidate)) {
    return { score: 0, registryCount: 0, categoryCount: 0, hasStructure: false };
  }

  const registryPath = path.join(candidate, '_system', 'repos.json');
  let registryCount = 0;
  if (fs.existsSync(registryPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(registryPath, 'utf8').replace(/^\uFEFF/, ''));
      registryCount = Array.isArray(data) ? data.length : 0;
    } catch {
      registryCount = 0;
    }
  }

  const categories = ['agents', 'skills', 'knowledge', 'tools', 'benchmarks'];
  let categoryCount = 0;
  for (const dir of categories) {
    const categoryPath = path.join(candidate, dir);
    if (!fs.existsSync(categoryPath)) continue;
    try {
      const entries = fs.readdirSync(categoryPath, { withFileTypes: true });
      if (entries.some(entry => entry.isDirectory() && !entry.name.startsWith('.'))) {
        categoryCount += 1;
      }
    } catch {
      // Ignore read errors
    }
  }

  const hasStructure = hasReposStructure(candidate);
  let score = 0;
  if (registryCount > 0) score += 1000 + registryCount;
  else if (fs.existsSync(registryPath)) score += 5;
  score += categoryCount * 10;
  if (hasStructure) score += 1;

  return { score, registryCount, categoryCount, hasStructure };
}

function autoDetectReposRoot() {
  if (process.platform !== 'win32') {
    const defaultPath = getDefaultReposRoot();
    return fs.existsSync(defaultPath) ? defaultPath : null;
  }

  const candidates = [];
  const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const baseDirs = ['Projects', 'projects', 'Repos', 'repos'];

  for (const drive of driveLetters) {
    const root = `${drive}:\\`;
    if (!fs.existsSync(root)) continue;

    candidates.push(path.join(root, 'reference-repos'));
    baseDirs.forEach((dir) => {
      candidates.push(path.join(root, dir, 'reference-repos'));
    });
  }

  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = getRepoCandidateScore(candidate);
    if (score.score > bestScore) {
      bestScore = score.score;
      best = candidate;
    }
  }

  return bestScore > 0 ? best : null;
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

  config.decisionMatrix = {
    ...DEFAULT_CONFIG.decisionMatrix,
    ...(config.decisionMatrix || {})
  };
  config.llm = {
    ...DEFAULT_CONFIG.llm,
    ...(config.llm || {})
  };
  config.evaluation = {
    ...DEFAULT_CONFIG.evaluation,
    ...(config.evaluation || {})
  };

  // Environment variable overrides
  if (process.env.REPOS_ROOT) {
    config.reposRoot = process.env.REPOS_ROOT;
  }
  if (process.env.CORTEX_OUTPUT_DIR) {
    config.outputDir = process.env.CORTEX_OUTPUT_DIR;
  }

  // LLM env overrides
  if (process.env.LLM_ENABLED) {
    config.llm.enabled = /^(1|true|yes)$/i.test(process.env.LLM_ENABLED);
  }
  if (process.env.LLM_PROVIDER) {
    config.llm.provider = process.env.LLM_PROVIDER;
  }
  if (process.env.LLM_MODEL) {
    config.llm.model = process.env.LLM_MODEL;
  }
  if (process.env.LLM_ENDPOINT) {
    config.llm.endpoint = process.env.LLM_ENDPOINT;
  }
  if (process.env.LLM_MODEL_DIR) {
    config.llm.modelDir = process.env.LLM_MODEL_DIR;
  }
  if (process.env.LLM_MODEL_PATH) {
    config.llm.modelPath = process.env.LLM_MODEL_PATH;
  }
  if (process.env.LLM_TIMEOUT_MS) {
    const parsed = Number(process.env.LLM_TIMEOUT_MS);
    if (!Number.isNaN(parsed)) config.llm.timeoutMs = parsed;
  }
  if (process.env.LLM_TEMPERATURE) {
    const parsed = Number(process.env.LLM_TEMPERATURE);
    if (!Number.isNaN(parsed)) config.llm.temperature = parsed;
  }
  if (process.env.LLM_MAX_TOKENS) {
    const parsed = Number(process.env.LLM_MAX_TOKENS);
    if (!Number.isNaN(parsed)) config.llm.maxTokens = parsed;
  }
  if (process.env.LLM_TOP_N) {
    const parsed = Number(process.env.LLM_TOP_N);
    if (!Number.isNaN(parsed)) config.llm.topN = parsed;
  }

  // Apply defaults if not set
  if (!config.reposRoot) {
    config.reposRoot = getDefaultReposRoot();
  }

  if (config.reposRoot) {
    const currentScore = getRepoCandidateScore(config.reposRoot);
    const detected = autoDetectReposRoot();
    const detectedScore = detected ? getRepoCandidateScore(detected) : { score: 0 };
    const isEmptyRoot = currentScore.registryCount === 0 && currentScore.categoryCount === 0;

    const shouldOverride =
      !fs.existsSync(config.reposRoot) ||
      !currentScore.hasStructure ||
      (isEmptyRoot && detectedScore.score > currentScore.score && detected !== config.reposRoot);

    if (shouldOverride && detected) {
      config.reposRoot = detected;
      saveConfig(config);
    }
  }
  if (!config.outputDir) {
    config.outputDir = getDefaultOutputDir();
  }
  if (!config.llm.modelDir) {
    config.llm.modelDir = getDefaultModelDir();
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
function validateReposRoot(reposPath, options = {}) {
  const strict = options.strict === true;
  const errors = [];
  const warnings = [];

  // Check if path is absolute
  if (!path.isAbsolute(reposPath)) {
    errors.push('Path must be absolute');
  }

  // Check if parent directory exists (for creation)
  const parent = path.dirname(reposPath);
  if (!fs.existsSync(parent)) {
    if (strict) {
      errors.push(`Parent directory does not exist: ${parent}`);
    } else {
      warnings.push(`Parent directory does not exist: ${parent}`);
    }
  }

  // Check write permissions on parent
  try {
    fs.accessSync(parent, fs.constants.W_OK);
  } catch {
    if (strict) {
      errors.push(`No write permission for: ${parent}`);
    } else {
      warnings.push(`No write permission for: ${parent}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
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

function loadPromptsFromFile() {
  if (!fs.existsSync(PROMPTS_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Error loading saved prompts:', e.message);
    return null;
  }
}

function savePromptsToFile(prompts) {
  try {
    fs.writeFileSync(PROMPTS_PATH, JSON.stringify(prompts, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving prompts:', e.message);
    return false;
  }
}

/**
 * Get all saved prompts
 */
function getSavedPrompts() {
  const fromFile = loadPromptsFromFile();
  if (fromFile) return fromFile;

  const config = loadConfig();
  const legacy = config.savedPrompts || [];
  if (legacy.length > 0) {
    savePromptsToFile(legacy);
    return legacy;
  }
  return [];
}

/**
 * Save a new prompt
 */
function savePrompt(title, query) {
  const prompts = getSavedPrompts();

  const newPrompt = {
    id: Date.now().toString(),
    title: title || 'Untitled',
    query,
    createdAt: new Date().toISOString()
  };

  prompts.unshift(newPrompt); // Add to beginning
  savePromptsToFile(prompts);
  return newPrompt;
}

/**
 * Update an existing prompt
 */
function updatePrompt(id, updates) {
  const prompts = getSavedPrompts();

  const index = prompts.findIndex(p => p.id === id);
  if (index === -1) return null;

  prompts[index] = {
    ...prompts[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  savePromptsToFile(prompts);
  return prompts[index];
}

/**
 * Delete a saved prompt
 */
function deletePrompt(id) {
  const prompts = getSavedPrompts();

  const initialLength = prompts.length;
  const next = prompts.filter(p => p.id !== id);

  if (next.length < initialLength) {
    savePromptsToFile(next);
    return true;
  }
  return false;
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
  getDefaultModelDir,
  getSystemInfo,
  recordSpawn,
  getAnalytics,
  getSavedPrompts,
  savePrompt,
  updatePrompt,
  deletePrompt,
  CONFIG_PATH
};
