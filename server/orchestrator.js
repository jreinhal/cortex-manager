const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- Configuration ---
const REPOS_ROOT = 'D:\\Projects\\reference-repos';
const TEMPLATE_PATH = path.join(REPOS_ROOT, 'agents', 'std-agent', 'template.md');
const KNOWLEDGE_DIR = path.join(REPOS_ROOT, 'knowledge');
const SKILLS_DIR = path.join(REPOS_ROOT, 'skills');
const TOOLS_DIR = path.join(REPOS_ROOT, 'tools');

// --- Helpers ---

// Auto-generate index to ensure it's fresh for Cloud LLM usage
function refreshIndex() {
    console.log("🔄 Updating Resource Index...");
    try {
        const genScript = path.join(__dirname, 'generate_index.js');
        if (fs.existsSync(genScript)) {
            execSync(`node "${genScript}"`);
        }
    } catch (e) {
        console.error("Index auto-update failed (non-critical):", e.message);
    }
}

// Simple token tokenizer
function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
}

// Recursive file walker
function walk(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);

    // Performance: Directories to strictly ignore
    const IGNORE = ['.git', 'node_modules', 'dist', 'build', 'vendor', 'coverage', '__pycache__'];

    files.forEach(file => {
        if (IGNORE.includes(file) || file.startsWith('.')) return;

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });
    return fileList;
}

// Score file relevance based on filename matching tokens
function findRelevantFiles(dir, tokens) {
    const allFiles = walk(dir);
    const matches = [];

    allFiles.forEach(file => {
        const filename = path.basename(file).toLowerCase();
        const filepath = file.toLowerCase();
        let score = 0;
        tokens.forEach(token => {
            if (filename.includes(token)) score += 5; // Strong match on filename
            if (filepath.includes(token)) score += 1; // Weak match on path
        });
        if (score > 0) {
            matches.push({ file, score });
        }
    });

    return matches.sort((a, b) => b.score - a.score).slice(0, 5).map(m => m.file);
}

function getAvailableAgents() {
    const agentsDir = path.join(REPOS_ROOT, 'agents');
    if (!fs.existsSync(agentsDir)) return [];

    return fs.readdirSync(agentsDir)
        .filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory() && !f.startsWith('.'))
        .map(dir => {
            const configPath = path.join(agentsDir, dir, 'agent.config.json');
            let config = {
                name: dir,
                description: "Standard Agent",
                keywords: [dir.toLowerCase()]
            };

            // Try to load custom config
            if (fs.existsSync(configPath)) {
                try {
                    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    config = { ...config, ...loaded };
                } catch (e) { console.error(`Error reading config for ${dir}:`, e.message); }
            } else {
                // Formatting defaults for known types if config missing
                if (dir === 'Agent-S') config.keywords = ['gui', 'ui', 'browser', 'os', 'visual'];
                if (dir === 'std-agent') config.keywords = ['research', 'coding', 'plan', 'write'];
            }

            return {
                id: dir,
                path: path.join(agentsDir, dir),
                ...config
            };
        });
}

function selectTemplate(goal) {
    const agents = getAvailableAgents();
    const g = goal.toLowerCase();

    // Find best match based on keyword overlap
    let bestMatch = null;
    let maxScore = 0;

    agents.forEach(agent => {
        let score = 0;
        agent.keywords.forEach(k => {
            if (g.includes(k.toLowerCase())) score += 1;
        });

        if (score > maxScore) {
            maxScore = score;
            bestMatch = agent;
        }
    });

    // Default to std-agent if no specific match
    if (!bestMatch) {
        // Fallback to searching for one named 'std-agent' or just the first one
        bestMatch = agents.find(a => a.id === 'std-agent') || agents[0];
    }

    // Determine template path (README.md or template.md)
    let templatePath = path.join(bestMatch.path, 'template.md');
    if (!fs.existsSync(templatePath)) {
        templatePath = path.join(bestMatch.path, 'README.md');
    }

    return {
        path: templatePath,
        name: `${bestMatch.name} (${bestMatch.description})`
    };
}

function readContent(filePaths) {
    if (filePaths.length === 0) return "No specific resources found.";
    return filePaths.map(fp => {
        // Read only first 2KB to avoid context overflow in this prototype
        const content = fs.readFileSync(fp, 'utf8').substring(0, 2000);
        return `--- RESOURCE: ${path.basename(fp)} ---\n${content}\n... (truncated)\n`;
    }).join('\n');
}

// --- Main ---

refreshIndex();

const goal = process.argv[2];
if (!goal) {
    console.error("Usage: node orchestrator.js \"<User Goal>\"");
    process.exit(1);
}

console.log(`\n🤖 ORCHESTRATOR: Analyzing goal: "${goal}"...`);

// 1. Tokenize Goal
const tokens = tokenize(goal);
console.log(`Keywords: [${tokens.join(', ')}]`);

// 2. Select Agent Template
const agentTemplate = selectTemplate(goal);
console.log(`Selected Agent: ${agentTemplate.name}`);

// 3. Search Resources
console.log("Searching Knowledge...");
const knowledgeFiles = findRelevantFiles(KNOWLEDGE_DIR, tokens);
knowledgeFiles.forEach(f => console.log(`  + Found: ${path.basename(f)}`));

console.log("Searching Skills...");
const skillsFiles = findRelevantFiles(SKILLS_DIR, tokens);
skillsFiles.forEach(f => console.log(`  + Found: ${path.basename(f)}`));

console.log("Searching Tools...");
const toolFiles = findRelevantFiles(TOOLS_DIR, tokens);
toolFiles.forEach(f => console.log(`  + Found: ${path.basename(f)}`));

// 4. Load & Fill Template
if (!fs.existsSync(agentTemplate.path)) {
    console.warn(`Warning: Template path ${agentTemplate.path} not found. Using Standard.`);
    agentTemplate.path = path.join(REPOS_ROOT, 'agents', 'std-agent', 'template.md');
}

let template = fs.readFileSync(agentTemplate.path, 'utf8');

// For Agent-S, match the name (which now includes description) or ID
if (agentTemplate.name.includes('Agent-S')) {
    template = `# SYSTEM ROLE: Agent-S (Wrapper)\n\n## CORE ARCHITECTURE\n${template}\n\n## INSTRUCTIONS\n`;
}

const knowledgeContent = readContent(knowledgeFiles);
const skillsContent = readContent(skillsFiles);
const toolsContent = readContent(toolFiles);

// 5. Output Construction (Tool-Optimized)

// Instead of dumping 50KB of text, we provide a "Flight Plan" for the Agent to execute using its own tools.
finalPrompt = `
# AGENT MISSION ORDER: ${goal}

## 1. IDENTITY ASSIGNMENT
**Selected Personnel:** ${agentTemplate.name}
**Directive:** Read and adopt the persona defined in:
\`${agentTemplate.path}\`

## 2. INTELLIGENCE BRIEFING (Required Reading)
The Orchestrator has identified the following critical resources. 
**ACTION:** Use your file reading tools to ingest these specific documents *immediately*.

### KNOWLEDGE (Context)
${knowledgeFiles.map(f => `- [ ] \`${f}\``).join('\n')}

### SKILLS (Procedures)
${skillsFiles.map(f => `- [ ] \`${f}\``).join('\n')}

### TOOLS (Capabilities)
${toolFiles.map(f => `- [ ] \`${f}\``).join('\n')}

## 3. EXECUTION
Once you have read the above files, proceed to execute the objective:
> ${goal}
`;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = `D:\\Projects\\reference-manager\\spawned_agent_${timestamp}.md`;
fs.writeFileSync(outPath, finalPrompt);

console.log(`\n✅ AGENT FLIGHT PLAN GENERATED!`);
console.log(`Mission Order saved to: ${outPath}`);
console.log(`\n--- PREVIEW ---\n`);
console.log(finalPrompt);

