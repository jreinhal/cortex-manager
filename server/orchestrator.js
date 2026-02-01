/**
 * CORTEX Orchestrator - Enhanced with semantic goal understanding
 * Generates intelligent "Flight Plans" for LLM agent execution
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Import new modules
const { analyzeGoal } = require('./goal-analyzer');
const { selectAgent } = require('./agent-selector');
const { findResources, formatForFlightPlan } = require('./resource-matcher');

// --- Configuration ---
const configPath = path.join(__dirname, '..', 'config.json');
let REPOS_ROOT;
let OUTPUT_DIR;

// Load config
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    REPOS_ROOT = process.env.REPOS_ROOT || config.reposRoot;
    OUTPUT_DIR = process.env.CORTEX_OUTPUT_DIR || config.outputDir;
  }
} catch (e) {
  console.error('Warning: Could not load config:', e.message);
}

// Fallbacks
if (!REPOS_ROOT) {
  REPOS_ROOT = process.env.REPOS_ROOT || path.join(os.homedir(), 'Projects', 'reference-repos');
}
if (!OUTPUT_DIR) {
  OUTPUT_DIR = path.join(__dirname, '..', 'spawned_agents');
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const AGENTS_DIR = path.join(REPOS_ROOT, 'agents');

// --- Helpers ---

function refreshIndex() {
  console.log("🔄 Updating Resource Index...");
  try {
    const genScript = path.join(__dirname, 'generate_index.js');
    if (fs.existsSync(genScript)) {
      execSync(`node "${genScript}"`, { env: { ...process.env, REPOS_ROOT } });
    }
  } catch (e) {
    console.error("Index auto-update failed (non-critical):", e.message);
  }
}

function getAgentTemplatePath(agentId) {
  const agentDir = path.join(AGENTS_DIR, agentId);
  let templatePath = path.join(agentDir, 'template.md');
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(agentDir, 'README.md');
  }
  return templatePath;
}

// --- Main Orchestration ---

function orchestrate(goal) {
  console.log(`\n🤖 CORTEX ORCHESTRATOR v2.0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📋 Goal: "${goal}"\n`);

  // Step 1: Analyze the goal semantically
  console.log("🔍 Analyzing goal...");
  const analysis = analyzeGoal(goal);

  console.log(`   Intent: ${analysis.intent.primary} (${Math.round(analysis.intent.confidence * 100)}% confidence)`);
  if (analysis.intent.secondary.length > 0) {
    console.log(`   Secondary: ${analysis.intent.secondary.join(', ')}`);
  }
  console.log(`   Complexity: ${analysis.complexity.level} (~${analysis.complexity.estimatedSteps} steps)`);

  const techDisplay = [
    ...analysis.techStack.languages,
    ...analysis.techStack.frameworks,
    ...analysis.techStack.inferred
  ].filter(Boolean);
  if (techDisplay.length > 0) {
    console.log(`   Tech Stack: ${techDisplay.join(', ')}`);
  }

  if (analysis.complexity.risks.length > 0) {
    console.log(`   ⚠️  Risks: ${analysis.complexity.risks.join('; ')}`);
  }

  // Step 2: Select best agent
  console.log("\n🎯 Selecting agent...");
  const selection = selectAgent(analysis, AGENTS_DIR);
  const selectedAgent = selection.selected;

  console.log(`   Selected: ${selectedAgent.agentName} (score: ${Math.round(selectedAgent.score)})`);
  if (selectedAgent.reasons.length > 0) {
    selectedAgent.reasons.slice(0, 3).forEach(r => console.log(`     • ${r}`));
  }

  if (selection.warnings.lowConfidence) {
    console.log(`   ⚠️  ${selection.warnings.lowConfidence.message}`);
  }
  if (selection.warnings.ambiguous) {
    console.log(`   ⚠️  ${selection.warnings.ambiguous.message}`);
  }

  if (selection.alternatives.length > 0) {
    console.log(`   Alternatives: ${selection.alternatives.map(a => `${a.agentId}(${Math.round(a.score)})`).join(', ')}`);
  }

  // Step 3: Find relevant resources with tech filtering
  console.log("\n📚 Searching resources...");
  const resources = findResources(analysis, REPOS_ROOT, { maxResults: 5, minScore: 0.15 });
  const formatted = formatForFlightPlan(resources);

  const knowledgeCount = formatted.knowledge.length;
  const skillsCount = formatted.skills.length;
  const toolsCount = formatted.tools.length;

  console.log(`   Knowledge: ${knowledgeCount} matches`);
  formatted.knowledge.slice(0, 3).forEach(r => {
    console.log(`     + ${path.basename(r.file)} (score: ${r.score}${r.techStack.length > 0 ? `, tech: ${r.techStack.slice(0, 2).join(',')}` : ''})`);
  });

  console.log(`   Skills: ${skillsCount} matches`);
  formatted.skills.slice(0, 3).forEach(r => {
    console.log(`     + ${path.basename(r.file)} (score: ${r.score}${r.techStack.length > 0 ? `, tech: ${r.techStack.slice(0, 2).join(',')}` : ''})`);
  });

  console.log(`   Tools: ${toolsCount} matches`);
  formatted.tools.slice(0, 3).forEach(r => {
    console.log(`     + ${path.basename(r.file)} (score: ${r.score})`);
  });

  // Step 4: Get agent template path
  const templatePath = getAgentTemplatePath(selectedAgent.agentId);

  // Step 5: Generate flight plan
  const flightPlan = generateFlightPlan({
    goal,
    analysis,
    selectedAgent,
    selection,
    resources: formatted,
    templatePath
  });

  // Step 6: Save flight plan
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(OUTPUT_DIR, `spawned_agent_${timestamp}.md`);
  fs.writeFileSync(outPath, flightPlan);

  console.log(`\n✅ FLIGHT PLAN GENERATED!`);
  console.log(`   Saved to: ${outPath}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n--- PREVIEW ---\n`);
  console.log(flightPlan);

  return {
    success: true,
    output: flightPlan,
    analysis,
    selection,
    resources: formatted,
    outputPath: outPath
  };
}

function generateFlightPlan({ goal, analysis, selectedAgent, selection, resources, templatePath }) {
  const knowledgeSection = resources.knowledge.length > 0
    ? resources.knowledge.map(r =>
        `- [ ] \`${r.file}\`${r.preview ? `\n      _"${r.preview}..."_` : ''}${r.techStack.length > 0 ? `\n      **Tech:** ${r.techStack.join(', ')}` : ''}`
      ).join('\n')
    : '_No matching knowledge resources found._';

  const skillsSection = resources.skills.length > 0
    ? resources.skills.map(r =>
        `- [ ] \`${r.file}\`${r.preview ? `\n      _"${r.preview}..."_` : ''}${r.techStack.length > 0 ? `\n      **Tech:** ${r.techStack.join(', ')}` : ''}`
      ).join('\n')
    : '_No matching skill resources found._';

  const toolsSection = resources.tools.length > 0
    ? resources.tools.map(r =>
        `- [ ] \`${r.file}\`${r.preview ? `\n      _"${r.preview}..."_` : ''}`
      ).join('\n')
    : '_No matching tool resources found._';

  const techStackDisplay = [
    ...analysis.techStack.languages,
    ...analysis.techStack.frameworks,
    ...analysis.techStack.inferred
  ].filter(Boolean);

  const risksSection = analysis.complexity.risks.length > 0
    ? `\n### ⚠️ Identified Risks\n${analysis.complexity.risks.map(r => `- ${r}`).join('\n')}\n`
    : '';

  const alternativesSection = selection.alternatives.length > 0
    ? `\n### Alternative Agents\n${selection.alternatives.map(a =>
        `- **${a.agentName}** (score: ${Math.round(a.score)}) - ${a.description || ''}`
      ).join('\n')}\n`
    : '';

  return `# AGENT MISSION ORDER: ${goal}

## 1. IDENTITY ASSIGNMENT

**Selected Agent:** ${selectedAgent.agentName}
**Agent ID:** ${selectedAgent.agentId}
**Selection Score:** ${Math.round(selectedAgent.score)}/100 (${Math.round(selectedAgent.confidence * 100)}% confidence)

**Directive:** Read and adopt the persona defined in:
\`${templatePath}\`

### Selection Rationale
${selectedAgent.reasons.map(r => `- ${r}`).join('\n')}
${alternativesSection}
## 2. GOAL ANALYSIS

| Dimension | Value |
|-----------|-------|
| **Primary Intent** | ${analysis.intent.primary} |
| **Confidence** | ${Math.round(analysis.intent.confidence * 100)}% |
| **Complexity** | ${analysis.complexity.level} |
| **Estimated Steps** | ~${analysis.complexity.estimatedSteps} |
| **Action Type** | ${analysis.actions.actionType} |
| **Destructive** | ${analysis.actions.isDestructive ? '⚠️ Yes' : 'No'} |
| **Requires Review** | ${analysis.actions.requiresReview ? '✋ Yes' : 'No'} |
${techStackDisplay.length > 0 ? `| **Tech Stack** | ${techStackDisplay.join(', ')} |` : ''}

### Required Capabilities
${Object.entries(analysis.capabilities)
  .filter(([k, v]) => v === true)
  .map(([k]) => `- ${k}`)
  .join('\n') || '- No specific capabilities required'}
${risksSection}
## 3. INTELLIGENCE BRIEFING

The Orchestrator has identified the following resources using **semantic matching** and **tech stack filtering**.
**ACTION:** Use your file reading tools to ingest these documents.

### KNOWLEDGE (Context)
${knowledgeSection}

### SKILLS (Procedures)
${skillsSection}

### TOOLS (Capabilities)
${toolsSection}

## 4. EXECUTION

Once you have read the above files, proceed to execute the objective:

> ${goal}

### Execution Guidelines
1. Follow the intent: **${analysis.intent.primary}**
2. Complexity level: **${analysis.complexity.level}** - plan accordingly
${analysis.actions.requiresReview ? '3. ✋ This task requires human review before finalizing\n' : ''}${analysis.actions.isDestructive ? '4. ⚠️ This is a destructive operation - proceed with caution\n' : ''}

---
_Generated by CORTEX Orchestrator v2.0_
_Timestamp: ${new Date().toISOString()}_
_Agent: ${selectedAgent.agentId}_
_Intent: ${analysis.intent.primary} (${Math.round(analysis.intent.confidence * 100)}% confidence)_
_Complexity: ${analysis.complexity.level}_
_Resources: ${resources.knowledge.length + resources.skills.length + resources.tools.length} files_
`;
}

// --- CLI Entry Point ---

refreshIndex();

const goal = process.argv[2];
if (!goal) {
  console.error("Usage: node orchestrator.js \"<User Goal>\"");
  process.exit(1);
}

const result = orchestrate(goal);
if (!result.success) {
  process.exit(1);
}

module.exports = { orchestrate, analyzeGoal };
