const fs = require('fs');
const path = require('path');
const os = require('os');

// Load config
const configPath = path.join(__dirname, '..', 'config.json');
let REPOS_ROOT;

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    REPOS_ROOT = process.env.REPOS_ROOT || config.reposRoot;
  }
} catch (e) {
  console.error('Warning: Could not load config:', e.message);
}

// Fallback
if (!REPOS_ROOT) {
  REPOS_ROOT = process.env.REPOS_ROOT || path.join(os.homedir(), 'Projects', 'reference-repos');
}

const OUTPUT_FILE = path.join(REPOS_ROOT, 'resource_index.md');

// Directories to ignore
const IGNORE_DIRS = ['.git', 'node_modules', 'dist', 'build', 'vendor', 'coverage', '__pycache__', '.next', '.venv', 'venv'];

function walk(dir, prefix = '') {
  let output = '';
  if (!fs.existsSync(dir)) return output;

  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return output; // Skip directories we can't read
  }

  // Sort directories first, then files
  files.sort((a, b) => {
    const aPath = path.join(dir, a);
    const bPath = path.join(dir, b);
    try {
      const aStat = fs.statSync(aPath);
      const bStat = fs.statSync(bPath);
      if (aStat.isDirectory() && !bStat.isDirectory()) return -1;
      if (!aStat.isDirectory() && bStat.isDirectory()) return 1;
    } catch (e) {
      // Skip files we can't stat
    }
    return a.localeCompare(b);
  });

  files.forEach(file => {
    if (file.startsWith('.') || IGNORE_DIRS.includes(file)) return;

    const fullPath = path.join(dir, file);

    try {
      const stat = fs.statSync(fullPath);
      const relPath = path.relative(REPOS_ROOT, fullPath).replace(/\\/g, '/');

      if (stat.isDirectory()) {
        output += `${prefix}- 📂 **${file}**/\n`;
        output += walk(fullPath, prefix + '  ');
      } else {
        output += `${prefix}- 📄 [${file}](${relPath})\n`;
      }
    } catch (e) {
      // Skip files we can't access
    }
  });
  return output;
}

console.log("Generating Resource Index...");
console.log(`REPOS_ROOT: ${REPOS_ROOT}`);

const header = `# CORTEX Reference Repositories Index
Generated: ${new Date().toISOString()}
Root: ${REPOS_ROOT}

This document lists all available modular resources (Agents, Knowledge, Skills, Tools) that can be orchestrated.

---

`;

const content = walk(REPOS_ROOT);

try {
  fs.writeFileSync(OUTPUT_FILE, header + content);
  console.log(`Index saved to: ${OUTPUT_FILE}`);
} catch (e) {
  console.error(`Failed to write index: ${e.message}`);
}
