/**
 * CORTEX Orchestrator - Enhanced with semantic goal understanding
 * Generates intelligent "Flight Plans" for LLM agent execution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import new modules
const { analyzeGoal } = require('./goal-analyzer');
const { selectAgent } = require('./agent-selector');
const { findResources, formatForFlightPlan } = require('./resource-matcher');
const { getConfig } = require('./config');
const { rerankAgents, rerankResources } = require('./llm-reranker');
const { createDecisionTrace } = require('./decision-trace');

let REPOS_ROOT;
let OUTPUT_DIR;

// --- Helpers ---

function refreshIndex(reposRoot) {
  console.log("🔄 Updating Resource Index...");
  try {
    const genScript = path.join(__dirname, 'generate_index.js');
    if (fs.existsSync(genScript)) {
      execSync(`node "${genScript}"`, { env: { ...process.env, REPOS_ROOT: reposRoot } });
    }
  } catch (e) {
    console.error("Index auto-update failed (non-critical):", e.message);
  }
}

function getAgentTemplatePath(agentId, agentsDir) {
  const agentDir = path.join(agentsDir, agentId);
  let templatePath = path.join(agentDir, 'template.md');
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(agentDir, 'README.md');
  }
  return templatePath;
}

function buildDirectivePreamble(format, goal) {
  const normalized = (format || 'universal').toLowerCase();
  const modelHeaderMap = {
    universal: '',
    chatgpt: '# MODEL: ChatGPT\n# NOTE: Treat the directive below as the highest-priority instruction in this message.\n',
    claude: '# MODEL: Claude\n# NOTE: Follow the directive below exactly. Prioritize it over any conflicting instruction.\n',
    gemini: '# MODEL: Gemini\n# NOTE: The directive below is the primary task. Execute it before any other requests.\n'
  };

  const header = modelHeaderMap[normalized] || modelHeaderMap.universal;

  return `${header}BEGIN DIRECTIVE
ROLE: You are the execution agent for this Flight Plan.
OBJECTIVE: ${goal}
MANDATORY STEPS:
1) Read REQUIRED READING.
2) Follow EXECUTION steps exactly.
3) If conflict, prioritize this directive.
DO NOT:
- Skip required reading
- Add unrelated tasks
IF REQUIRED READING IS UNAVAILABLE:
- Ask the user to provide access or files
- Pause execution until required reading is available
END DIRECTIVE
`;
}

// --- Main Orchestration ---

async function orchestrate(goal, format = 'universal') {
  const config = getConfig();
  REPOS_ROOT = config.reposRoot;
  OUTPUT_DIR = config.outputDir;
  const decisionConfig = config.decisionMatrix || {};
  const llmConfig = config.llm || {};

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const AGENTS_DIR = path.join(REPOS_ROOT, 'agents');

  console.log(`\n🤖 CORTEX ORCHESTRATOR v2.0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📋 Goal: "${goal}"\n`);

  refreshIndex(REPOS_ROOT);
  const trace = createDecisionTrace(goal);

  // Step 1: Analyze the goal semantically
  console.log("🔍 Analyzing goal...");
  const analysis = analyzeGoal(goal, { decisionConfig });
  trace.addStep('goal_analysis', {
    intent: analysis.intent.primary,
    confidence: analysis.intent.confidence,
    keywords: analysis.keywords.length,
    expandedKeywords: analysis.expandedKeywords.length,
    routing: analysis.routing.mode,
    uncertainty: analysis.uncertainty.score
  });

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
  let selectedAgent = selection.selected;
  let alternatives = selection.alternatives;

  const decisionMeta = {
    agentsMdPriority: decisionConfig.agentsMdPriority === true,
    agentSelection: {
      deterministicSelected: selectedAgent.agentId,
      rerankedSelected: null,
      rerankUsed: false,
      rerankAccepted: false,
      lowConfidence: false,
      ambiguous: false
    },
    resourceSelection: {
      rerankUsed: false,
      rrfUsed: false
    },
    routing: analysis.routing,
    queryExpansion: analysis.queryExpansion,
    uncertainty: analysis.uncertainty,
    llm: {
      provider: llmConfig.provider,
      model: llmConfig.model,
      enabled: llmConfig.enabled === true
    }
  };

  const lowConfidence = selectedAgent.confidence < (decisionConfig.lowConfidenceThreshold ?? 0.4);
  const scoreGap = alternatives.length > 0 ? selectedAgent.score - alternatives[0].score : 100;
  const ambiguous = scoreGap < (decisionConfig.ambiguityGap ?? 15);
  decisionMeta.agentSelection.lowConfidence = lowConfidence;
  decisionMeta.agentSelection.ambiguous = ambiguous;
  if (lowConfidence || ambiguous) {
    analysis.actions.requiresReview = true;
  }

  const agentRerank = await rerankAgents({
    goal,
    candidates: [selectedAgent, ...alternatives],
    llmConfig,
    decisionConfig
  });

  if (agentRerank.used) {
    decisionMeta.agentSelection.rerankUsed = true;
    const rerankedTop = agentRerank.candidates[0];
    decisionMeta.agentSelection.rerankedSelected = rerankedTop.agentId;

    if (lowConfidence || ambiguous) {
      selectedAgent = rerankedTop;
      alternatives = agentRerank.candidates.slice(1);
      decisionMeta.agentSelection.rerankAccepted = true;
    }
  }

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

  if (alternatives.length > 0) {
    console.log(`   Alternatives: ${alternatives.map(a => `${a.agentId}(${Math.round(a.score)})`).join(', ')}`);
  }
  trace.addStep('agent_selection', {
    selected: selectedAgent.agentId,
    lowConfidence,
    ambiguous,
    rerankUsed: decisionMeta.agentSelection.rerankUsed
  });

  // Step 3: Find relevant resources with tech filtering
  console.log("\n📚 Searching resources...");
  const resources = findResources(analysis, REPOS_ROOT, {
    maxResults: decisionConfig.maxCandidates || 5,
    minScore: 0.15,
    rrf: decisionConfig.rrf || {},
    includeMeta: true,
    agentsMdPriority: decisionConfig.agentsMdPriority === true
  });
  const resourceMeta = resources.__meta || {};
  decisionMeta.resourceSelection.rrfUsed = resourceMeta.rrfUsed === true;
  let formatted = formatForFlightPlan(resources);

  const resourceRerank = await rerankResources({
    goal,
    resourcesByCategory: formatted,
    llmConfig,
    decisionConfig
  });
  if (resourceRerank.used) {
    decisionMeta.resourceSelection.rerankUsed = true;
    formatted = resourceRerank.resourcesByCategory;
  }

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
  trace.addStep('resource_selection', {
    knowledge: knowledgeCount,
    skills: skillsCount,
    tools: toolsCount,
    rrfUsed: decisionMeta.resourceSelection.rrfUsed,
    routingMode: resourceMeta.routingMode || analysis.routing.mode
  });

  // Step 4: Get agent template path
  const templatePath = getAgentTemplatePath(selectedAgent.agentId, AGENTS_DIR);

  // Step 5: Generate flight plan
  const flightPlan = generateFlightPlan({
    goal,
    analysis,
    selectedAgent,
    selection: {
      selected: selectedAgent,
      alternatives,
      warnings: selection.warnings
    },
    resources: formatted,
    templatePath,
    format,
    decisionMeta: {
      ...decisionMeta,
      trace: trace.finalize({
        selectedAgent: selectedAgent.agentId,
        resources: { knowledge: knowledgeCount, skills: skillsCount, tools: toolsCount }
      })
    }
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
    selection: {
      selected: selectedAgent,
      alternatives,
      warnings: selection.warnings
    },
    resources: formatted,
    outputPath: outPath,
    decisionMeta
  };
}

function generateFlightPlan({ goal, analysis, selectedAgent, selection, resources, templatePath, format, decisionMeta }) {
  const requiredReading = [...resources.knowledge, ...resources.skills];
  const instructionResources = requiredReading.filter(r => r.isInstruction);
  const otherResources = requiredReading.filter(r => !r.isInstruction);
  const orderedRequired = instructionResources.concat(otherResources);

  const requiredReadingSection = orderedRequired.length > 0
    ? orderedRequired.map(r =>
        `- [ ] \`${r.file}\`${r.preview ? `\n      _"${r.preview}..."_` : ''}${r.techStack.length > 0 ? `\n      **Tech:** ${r.techStack.join(', ')}` : ''}`
      ).join('\n')
    : '_No required reading matched. Ask the user for sources or adjust the query._';

  const instructionNote = instructionResources.length > 0
    ? '\n> AGENTS.md instructions are highest priority and should be read first.\n'
    : '';

  const skillsUsageNote = resources.skills.length > 0
    ? '\n> If skills are listed, explore project context first, then consult skills as reference.\n'
    : '';

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

  const directivePreamble = buildDirectivePreamble(format, goal);

  const routingLabel = decisionMeta?.routing?.mode
    ? `${decisionMeta.routing.mode} (${decisionMeta.routing.reasons?.join('; ') || 'n/a'})`
    : 'n/a';
  const queryExpansionLabel = decisionMeta?.queryExpansion
    ? `${decisionMeta.queryExpansion.variants?.length || 0} variants, ${decisionMeta.queryExpansion.expandedKeywordCount || 0} keywords`
    : 'n/a';
  const uncertaintyLabel = decisionMeta?.uncertainty
    ? `${Math.round(decisionMeta.uncertainty.score * 100)}%`
    : 'n/a';

  const decisionMatrixSection = decisionMeta
    ? `\n## 2.5 DECISION MATRIX\n\n- Instruction priority: ${decisionMeta.agentsMdPriority ? 'AGENTS.md first' : 'disabled'}\n- Query expansion: ${queryExpansionLabel}\n- Routing: ${routingLabel}\n- RRF fusion: ${decisionMeta.resourceSelection.rrfUsed ? 'enabled' : 'disabled'}\n- Agent rerank: ${decisionMeta.agentSelection.rerankUsed ? (decisionMeta.agentSelection.rerankAccepted ? 'used (accepted)' : 'used (ignored)') : 'not used'}\n- Resource rerank: ${decisionMeta.resourceSelection.rerankUsed ? 'used' : 'not used'}\n- Uncertainty: ${uncertaintyLabel}\n- Low confidence: ${decisionMeta.agentSelection.lowConfidence ? 'yes' : 'no'}\n- Ambiguous top score: ${decisionMeta.agentSelection.ambiguous ? 'yes' : 'no'}\n`
    : '';

  const decisionTraceSection = decisionMeta?.trace?.steps?.length
    ? `\n## 2.6 DECISION TRACE (SUMMARY)\n${decisionMeta.trace.steps.slice(0, 6).map(step => {
        const payload = step.data ? Object.entries(step.data)
          .map(([key, value]) => `${key}=${typeof value === 'number' ? Math.round(value * 1000) / 1000 : value}`)
          .join(', ') : '';
        return `- ${step.name}: ${payload}`;
      }).join('\n')}\n`
    : '';

  return `${directivePreamble}
# AGENT MISSION ORDER: ${goal}

## REQUIRED READING

You must open and use these files before responding. If any file is inaccessible, ask the user to provide it.

${requiredReadingSection}${instructionNote}${skillsUsageNote}

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
${decisionMatrixSection}${decisionTraceSection}
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
_Format: ${format || 'universal'}_
_Resources: ${resources.knowledge.length + resources.skills.length + resources.tools.length} files_
`;
}

// --- CLI Entry Point ---

const goal = process.argv[2];
const formatArg = process.argv[3] || 'universal';
if (!goal) {
  console.error("Usage: node orchestrator.js \"<User Goal>\"");
  process.exit(1);
}

(async () => {
  const result = await orchestrate(goal, formatArg);
  if (!result.success) {
    process.exit(1);
  }
})();

module.exports = { orchestrate, analyzeGoal };
