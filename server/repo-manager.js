/**
 * CORTEX Repository Manager
 * Cross-platform replacement for PowerShell scripts
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { getConfig } = require('./config');

/**
 * Execute git command and return result
 */
function gitExec(args, cwd = null) {
  try {
    const result = execSync(`git ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result.trim() };
  } catch (e) {
    return { success: false, error: e.message, output: e.stdout || '' };
  }
}

/**
 * Check if git is available
 */
function isGitAvailable() {
  try {
    execSync('git --version', { encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the registry file path
 */
function getRegistryPath() {
  const config = getConfig();
  return path.join(config.reposRoot, '_system', 'repos.json');
}

/**
 * Load repos registry
 */
function loadRegistry() {
  const registryPath = getRegistryPath();
  try {
    if (fs.existsSync(registryPath)) {
      const data = fs.readFileSync(registryPath, 'utf8').replace(/^\uFEFF/, '');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading registry:', e.message);
  }
  return [];
}

/**
 * Save repos registry
 */
function saveRegistry(repos) {
  const registryPath = getRegistryPath();
  const dir = path.dirname(registryPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(registryPath, JSON.stringify(repos, null, 2), 'utf8');
}

/**
 * Detect the default branch of a repository
 */
function detectDefaultBranch(repoPath) {
  // Try to get remote HEAD reference
  const result = gitExec('symbolic-ref refs/remotes/origin/HEAD', repoPath);
  if (result.success) {
    // Extract branch name from refs/remotes/origin/main
    const match = result.output.match(/refs\/remotes\/origin\/(.+)/);
    if (match) return match[1];
  }

  // Fallback: check for common branch names
  const branches = ['main', 'master', 'develop'];
  for (const branch of branches) {
    const checkResult = gitExec(`rev-parse --verify ${branch}`, repoPath);
    if (checkResult.success) return branch;
  }

  return 'main'; // Ultimate fallback
}

/**
 * Analyze repository content to determine category
 */
function analyzeRepoContent(repoPath) {
  const scores = {
    agents: 0,
    skills: 0,
    knowledge: 0,
    tools: 0,
    benchmarks: 0
  };

  // Check for indicator files
  const fileIndicators = {
    'Dockerfile': { agents: 3, tools: 2 },
    'setup.py': { tools: 2 },
    'package.json': { tools: 1 },
    'agent.config.json': { agents: 10 },
    'template.md': { agents: 5, skills: 3 },
    '.env.example': { tools: 2 },
    'requirements.txt': { tools: 1 }
  };

  // Check for indicator directories
  const dirIndicators = {
    'prompts': { skills: 5, agents: 2 },
    'evals': { benchmarks: 5 },
    'papers': { knowledge: 4 },
    'docs': { knowledge: 2 },
    'examples': { skills: 2, knowledge: 1 },
    'tests': { benchmarks: 2 },
    'src': { tools: 1 }
  };

  // Score based on files
  Object.keys(fileIndicators).forEach(file => {
    if (fs.existsSync(path.join(repoPath, file))) {
      const indicator = fileIndicators[file];
      Object.keys(indicator).forEach(cat => {
        scores[cat] += indicator[cat];
      });
    }
  });

  // Score based on directories
  Object.keys(dirIndicators).forEach(dir => {
    if (fs.existsSync(path.join(repoPath, dir))) {
      const indicator = dirIndicators[dir];
      Object.keys(indicator).forEach(cat => {
        scores[cat] += indicator[cat];
      });
    }
  });

  // Check README for keywords
  const readmePath = path.join(repoPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    try {
      const readme = fs.readFileSync(readmePath, 'utf8').toLowerCase();
      const keywordScores = {
        'autonomous agent': { agents: 5 },
        'ai agent': { agents: 3 },
        'llm agent': { agents: 3 },
        'prompt engineering': { skills: 4 },
        'benchmark': { benchmarks: 4 },
        'evaluation': { benchmarks: 3 },
        'documentation': { knowledge: 3 },
        'awesome list': { knowledge: 5 },
        'mcp server': { tools: 5 },
        'cli tool': { tools: 3 }
      };

      Object.keys(keywordScores).forEach(keyword => {
        if (readme.includes(keyword)) {
          const indicator = keywordScores[keyword];
          Object.keys(indicator).forEach(cat => {
            scores[cat] += indicator[cat];
          });
        }
      });
    } catch (e) {
      // Ignore read errors
    }
  }

  // Check repo name heuristics
  const repoName = path.basename(repoPath).toLowerCase();
  if (repoName.startsWith('awesome-')) scores.knowledge += 10;
  if (repoName.includes('agent')) scores.agents += 3;
  if (repoName.includes('skill')) scores.skills += 3;
  if (repoName.includes('tool')) scores.tools += 3;
  if (repoName.includes('benchmark') || repoName.includes('eval')) scores.benchmarks += 3;

  // Find highest scoring category
  let maxScore = 0;
  let category = 'knowledge'; // Default

  Object.keys(scores).forEach(cat => {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      category = cat;
    }
  });

  return {
    category,
    scores,
    confidence: maxScore > 5 ? 'high' : maxScore > 2 ? 'medium' : 'low'
  };
}

/**
 * Scan for repositories in the repos root
 */
function scanRepositories(progressCallback = null) {
  const config = getConfig();
  const reposRoot = config.reposRoot;
  const results = {
    found: [],
    errors: [],
    newRepos: 0,
    existingRepos: 0
  };

  if (!fs.existsSync(reposRoot)) {
    results.errors.push(`Repos root not found: ${reposRoot}`);
    return results;
  }

  // Get existing registry
  const existingRegistry = loadRegistry();
  const existingPaths = new Set(existingRegistry.map(r => r.Path));

  // Scan category directories
  const categories = ['agents', 'skills', 'knowledge', 'tools', 'benchmarks'];

  categories.forEach(category => {
    const categoryDir = path.join(reposRoot, category);
    if (!fs.existsSync(categoryDir)) return;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });

    entries.forEach(entry => {
      if (!entry.isDirectory() || entry.name.startsWith('.')) return;

      const repoPath = path.join(categoryDir, entry.name);
      const gitDir = path.join(repoPath, '.git');

      // Check if it's a git repository
      if (!fs.existsSync(gitDir)) return;

      if (progressCallback) {
        progressCallback(`Scanning: ${entry.name}`);
      }

      // Detect branch
      const branch = detectDefaultBranch(repoPath);

      const repo = {
        Name: entry.name,
        Path: repoPath,
        Branch: branch,
        Enabled: true,
        Category: category,
        LastScanned: new Date().toISOString()
      };

      results.found.push(repo);

      if (!existingPaths.has(repoPath)) {
        results.newRepos++;
      } else {
        results.existingRepos++;
      }
    });
  });

  // Update registry with found repos
  if (results.found.length > 0) {
    saveRegistry(results.found);
  }

  return results;
}

/**
 * Clone a repository and auto-categorize it
 */
async function cloneRepository(url, progressCallback = null) {
  const config = getConfig();
  const reposRoot = config.reposRoot;

  if (!isGitAvailable()) {
    return { success: false, error: 'Git is not installed or not in PATH' };
  }

  // Extract repo name from URL
  const repoName = path.basename(url, '.git').replace(/\.git$/, '');

  if (progressCallback) progressCallback(`Cloning: ${repoName}`);

  // Clone to temp location first
  const tempDir = path.join(require('os').tmpdir(), `cortex-clone-${Date.now()}`);

  try {
    // Clone repository
    const cloneResult = gitExec(`clone "${url}" "${tempDir}"`);
    if (!cloneResult.success) {
      return { success: false, error: `Clone failed: ${cloneResult.error}` };
    }

    if (progressCallback) progressCallback(`Analyzing: ${repoName}`);

    // Analyze content to determine category
    const analysis = analyzeRepoContent(tempDir);
    const category = analysis.category;

    if (progressCallback) progressCallback(`Categorized as: ${category} (${analysis.confidence} confidence)`);

    // Determine final destination
    const categoryDir = path.join(reposRoot, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    const destPath = path.join(categoryDir, repoName);

    // Check if already exists
    if (fs.existsSync(destPath)) {
      // Clean up temp
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { success: false, error: `Repository already exists at: ${destPath}` };
    }

    // Move from temp to final location
    fs.renameSync(tempDir, destPath);

    // Add safe.directory config for git
    gitExec(`config --global --add safe.directory "${destPath}"`);

    // Detect branch
    const branch = detectDefaultBranch(destPath);

    // Update registry
    const registry = loadRegistry();
    registry.push({
      Name: repoName,
      Path: destPath,
      Branch: branch,
      Enabled: true,
      Category: category,
      ClonedAt: new Date().toISOString()
    });
    saveRegistry(registry);

    if (progressCallback) progressCallback(`Complete: ${repoName}`);

    return {
      success: true,
      repo: {
        name: repoName,
        path: destPath,
        category,
        branch,
        analysis
      }
    };

  } catch (e) {
    // Clean up temp on error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}

    return { success: false, error: e.message };
  }
}

/**
 * Remove a repository from registry (optionally delete files)
 */
function removeRepository(repoName, deleteFiles = false) {
  const registry = loadRegistry();
  const repo = registry.find(r => r.Name === repoName);

  if (!repo) {
    return { success: false, error: `Repository not found: ${repoName}` };
  }

  // Remove from registry
  const newRegistry = registry.filter(r => r.Name !== repoName);
  saveRegistry(newRegistry);

  // Optionally delete files
  if (deleteFiles && fs.existsSync(repo.Path)) {
    try {
      fs.rmSync(repo.Path, { recursive: true, force: true });
    } catch (e) {
      return { success: true, warning: `Removed from registry but failed to delete files: ${e.message}` };
    }
  }

  return { success: true, removed: repo };
}

/**
 * Update a repository (git pull)
 */
function updateRepository(repoName) {
  const registry = loadRegistry();
  const repo = registry.find(r => r.Name === repoName);

  if (!repo) {
    return { success: false, error: `Repository not found: ${repoName}` };
  }

  if (!fs.existsSync(repo.Path)) {
    return { success: false, error: `Repository path not found: ${repo.Path}` };
  }

  const result = gitExec('pull', repo.Path);
  return {
    success: result.success,
    output: result.output || result.error
  };
}

/**
 * Get list of categories
 */
function getCategories() {
  const config = getConfig();
  const reposRoot = config.reposRoot;

  if (!fs.existsSync(reposRoot)) {
    return [];
  }

  return fs.readdirSync(reposRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map(d => d.name);
}

module.exports = {
  scanRepositories,
  cloneRepository,
  removeRepository,
  updateRepository,
  loadRegistry,
  saveRegistry,
  getCategories,
  analyzeRepoContent,
  isGitAvailable,
  detectDefaultBranch
};
