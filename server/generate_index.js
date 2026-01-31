const fs = require('fs');
const path = require('path');

const REPOS_ROOT = 'D:\\Projects\\reference-repos';
const OUTPUT_FILE = path.join(REPOS_ROOT, 'resource_index.md');

function walk(dir, prefix = '') {
    let output = '';
    if (!fs.existsSync(dir)) return output;

    const files = fs.readdirSync(dir);

    // Sort directories first, then files
    files.sort((a, b) => {
        const aPath = path.join(dir, a);
        const bPath = path.join(dir, b);
        const aStat = fs.statSync(aPath);
        const bStat = fs.statSync(bPath);
        if (aStat.isDirectory() && !bStat.isDirectory()) return -1;
        if (!aStat.isDirectory() && bStat.isDirectory()) return 1;
        return a.localeCompare(b);
    });

    files.forEach(file => {
        if (file.startsWith('.') || file === 'node_modules') return;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        const relPath = path.relative(REPOS_ROOT, fullPath).replace(/\\/g, '/');

        if (stat.isDirectory()) {
            output += `${prefix}- 📂 **${file}**/\n`;
            output += walk(fullPath, prefix + '  ');
        } else {
            // Add brief summary or size? Just path for now to save tokens.
            output += `${prefix}- 📄 [${file}](${relPath})\n`;
        }
    });
    return output;
}

console.log("Generating Resource Index...");
const header = `# CORTEX Reference Repositories Index
Generated: ${new Date().toISOString()}
Root: ${REPOS_ROOT}

This document lists all available modular resources (Agents, Knowledge, Skills, Tools) that can be orchestrated.

---

`;

const content = walk(REPOS_ROOT);
fs.writeFileSync(OUTPUT_FILE, header + content);
console.log(`Index saved to: ${OUTPUT_FILE}`);
