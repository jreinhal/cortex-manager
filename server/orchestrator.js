/**
 * CORTEX Orchestrator - Enhanced with semantic goal understanding
 * Generates intelligent "Flight Plans" for LLM agent execution
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { performance } = require('perf_hooks');

// Import new modules
const { analyzeGoal } = require('./goal-analyzer');
const { selectAgent } = require('./agent-selector');
const { findResources, formatForFlightPlan } = require('./resource-matcher');
const { getConfig } = require('./config');
const { rerankAgents, rerankResources: rerankResourcesLlm } = require('./llm-reranker');
const { rerankResources: rerankResourcesLate } = require('./late-interaction-reranker');
const { createDecisionTrace } = require('./decision-trace');
const { evaluateRetrievalGate } = require('./retrieval-gate');
const { recordRun } = require('./runs-store');
const { estimateTokens, estimateCost } = require('./token-estimator');
const externalSkills = require('./external-skills');
const vectorIndex = require('./vector-index');

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeQualityScore({ uncertainty, resourceTotal, retrievalEnabled, lowConfidence, ambiguous }) {
  let score = 70;
  if (typeof uncertainty === 'number') {
    score -= Math.round(uncertainty * 35);
  }
  score += Math.min(20, resourceTotal * 2);
  if (!retrievalEnabled) score -= 10;
  if (lowConfidence) score -= 10;
  if (ambiguous) score -= 5;
  return clamp(score, 0, 100);
}

function generateRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getGitMetadata(cwd) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'pipe' });
  } catch {
    return null;
  }

  const exec = (cmd) => {
    try {
      return execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();
    } catch {
      return '';
    }
  };

  const commit = exec('git rev-parse HEAD');
  const branch = exec('git rev-parse --abbrev-ref HEAD');
  const message = exec('git log -1 --pretty=%s');
  const status = exec('git status --porcelain');
  const diffStat = exec('git diff --stat');
  const changedFiles = status
    ? status.split('\n').map(line => line.trim()).filter(Boolean).map(line => line.substring(3))
    : [];

  return {
    commit: commit || null,
    branch: branch || null,
    message: message || null,
    dirty: Boolean(status),
    changedFiles,
    diffStat: diffStat || null
  };
}

// --- Main Orchestration ---

async function orchestrate(goal, format = 'universal') {
  const startedAt = Date.now();
  const perfStart = performance.now();
  const spans = [];
  const startSpan = (name) => {
    const start = performance.now();
    return () => {
      spans.push({
        name,
        startMs: Math.round(start - perfStart),
        durationMs: Math.round(performance.now() - start)
      });
    };
  };
  const config = getConfig();
  REPOS_ROOT = config.reposRoot;
  OUTPUT_DIR = config.outputDir;
  const workspaceId = process.env.CORTEX_WORKSPACE_ID || null;
  const decisionConfig = config.decisionMatrix || {};
  const llmConfig = config.llm || {};
  const llmRerankPolicy = {
    mode: 'lowConfidence',
    agentMode: 'advisory',
    resourceMode: 'lowConfidence',
    minUncertainty: 0.45,
    minTopScore: 0.35,
    minResourceCount: 3,
    allowWhenAmbiguous: true,
    allowWhenLowConfidence: true,
    ...(decisionConfig.llmRerank || {})
  };
  const agentRerankMode = llmRerankPolicy.agentMode || llmRerankPolicy.mode;
  const resourceRerankMode = llmRerankPolicy.resourceMode || llmRerankPolicy.mode;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const AGENTS_DIR = path.join(REPOS_ROOT, 'agents');

  console.log(`\n🤖 CORTEX ORCHESTRATOR v2.0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📋 Goal: "${goal}"\n`);

  const trace = createDecisionTrace(goal);

  // Step 1: Analyze the goal semantically
  console.log("🔍 Analyzing goal...");
  const endAnalyze = startSpan('analyze_goal');
  const analysis = analyzeGoal(goal, { decisionConfig, stackProfile: config.stackProfile });
  const retrievalGate = evaluateRetrievalGate(goal, analysis, decisionConfig.retrievalGate || {});
  analysis.retrieval = retrievalGate;
  endAnalyze();
  trace.addStep('goal_analysis', {
    intent: analysis.intent.primary,
    confidence: analysis.intent.confidence,
    keywords: analysis.keywords.length,
    expandedKeywords: analysis.expandedKeywords.length,
    routing: analysis.routing.mode,
    uncertainty: analysis.uncertainty.score,
    stackProfile: analysis.stackProfile?.enabled ? analysis.stackProfile.mode : 'disabled'
  });
  trace.addStep('retrieval_gate', {
    enabled: retrievalGate.enabled,
    reason: retrievalGate.reason,
    forced: retrievalGate.forced
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
  const endAgentSelect = startSpan('select_agent');
  const selection = selectAgent(analysis, AGENTS_DIR);
  let selectedAgent = selection.selected;
  let alternatives = selection.alternatives;

  const decisionMeta = {
    agentsMdPriority: decisionConfig.agentsMdPriority === true,
    stackProfile: analysis.stackProfile || null,
    agentSelection: {
      deterministicSelected: selectedAgent.agentId,
      rerankedSelected: null,
      rerankUsed: false,
      rerankAccepted: false,
      rerankReason: null,
      rerankForced: false,
      rerankPolicy: agentRerankMode,
      lowConfidence: false,
      ambiguous: false
    },
    resourceSelection: {
      rerankUsed: false,
      rerankPolicy: resourceRerankMode,
      rrfUsed: false,
      ragFusionUsed: false,
      hydeUsed: false,
      hybridUsed: false,
      lateInteractionUsed: false,
      retrievalEnabled: retrievalGate.enabled
    },
    routing: analysis.routing,
    queryExpansion: analysis.queryExpansion,
    retrievalGate,
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

  const allowAgentRerank =
    agentRerankMode === 'always' ||
    agentRerankMode === 'advisory' ||
    (agentRerankMode !== 'never' &&
      ((llmRerankPolicy.allowWhenLowConfidence && lowConfidence) ||
        (llmRerankPolicy.allowWhenAmbiguous && ambiguous)));
  decisionMeta.agentSelection.rerankEligible = allowAgentRerank;
  const forceAgentRerank = agentRerankMode === 'always' || agentRerankMode === 'advisory';

  const agentRerank = allowAgentRerank
    ? await rerankAgents({
        goal,
        candidates: [selectedAgent, ...alternatives],
        llmConfig,
        decisionConfig,
        force: forceAgentRerank
      })
    : { candidates: [selectedAgent, ...alternatives], used: false, reason: 'policy' };

  decisionMeta.agentSelection.rerankForced = agentRerank.forced === true;
  if (agentRerank.used) {
    decisionMeta.agentSelection.rerankUsed = true;
    const rerankedTop = agentRerank.candidates[0];
    decisionMeta.agentSelection.rerankedSelected = rerankedTop.agentId;

    const acceptRerank = agentRerankMode === 'always' || lowConfidence || ambiguous;
    if (acceptRerank) {
      selectedAgent = rerankedTop;
      alternatives = agentRerank.candidates.slice(1);
      decisionMeta.agentSelection.rerankAccepted = true;
    }
  } else {
    decisionMeta.agentSelection.rerankReason = agentRerank.reason || null;
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
  trace.addStep('agent_llm_router', {
    mode: agentRerankMode,
    used: decisionMeta.agentSelection.rerankUsed,
    forced: decisionMeta.agentSelection.rerankForced,
    accepted: decisionMeta.agentSelection.rerankAccepted,
    reason: decisionMeta.agentSelection.rerankReason || null
  });
  trace.addStep('agent_selection', {
    selected: selectedAgent.agentId,
    lowConfidence,
    ambiguous,
    rerankUsed: decisionMeta.agentSelection.rerankUsed,
    rerankAccepted: decisionMeta.agentSelection.rerankAccepted,
    rerankMode: agentRerankMode
  });
  endAgentSelect();

  // Step 2.5: Optionally pull external skills (provider registry)
  const onlineRequested = externalSkills.parseBoolean(process.env.CORTEX_ONLINE_SKILLS);
  const trainingModeRequested = process.env.CORTEX_ONLINE_SKILLS_TRAINING || null;

  let externalSkillsMeta = {
    enabled: config.externalSkills?.enabled === true,
    allowRemote: config.externalSkills?.allowRemote === true,
    mode: (config.externalSkills?.mode || 'off').toString().toLowerCase(),
    requestedOnline: onlineRequested,
    used: false,
    providers: [],
    attemptedProviders: [],
    selected: [],
    installed: [],
    query: null,
    queryAssist: { mode: 'off', used: false, queries: [] },
    training: { mode: externalSkills.normalizeTrainingMode(trainingModeRequested || config.externalSkills?.training?.mode || 'blocking') },
    skippedReason: null,
    error: null
  };

  const forceExternalSkills = onlineRequested === true;
  if (!retrievalGate.enabled && !forceExternalSkills) {
    externalSkillsMeta.skippedReason = 'retrieval_gate_disabled';
  } else {
    console.log("\n📦 Pulling external skills (providers)...");
    const endExternal = startSpan('external_skills_install');
    externalSkillsMeta = await externalSkills.pullExternalSkills({
      goal,
      analysis,
      config,
      reposRoot: REPOS_ROOT,
      workspaceId,
      request: {
        online: onlineRequested,
        trainingMode: trainingModeRequested
      }
    });
    endExternal();
  }

  decisionMeta.resourceSelection.externalSkills = externalSkillsMeta;
  trace.addStep('external_skills', {
    enabled: externalSkillsMeta.enabled,
    mode: externalSkillsMeta.mode,
    used: externalSkillsMeta.used,
    installed: externalSkillsMeta.installed.filter(i => i.installed).map(i => i.slug).join(',') || null,
    skippedReason: externalSkillsMeta.skippedReason,
    error: externalSkillsMeta.error
  });

  // Barrier: only "train" (index rebuild) after installs complete.
  refreshIndex(REPOS_ROOT);

  const installedNew = Array.isArray(externalSkillsMeta.installed) && externalSkillsMeta.installed.some((item) => item.installed === true);
  const vectorStatusBefore = vectorIndex.getStatus({ workspaceId });
  const vectorIndexMissing = vectorStatusBefore.enabled === true && !vectorStatusBefore.builtAt;
  const trainingMode = externalSkills.normalizeTrainingMode(externalSkillsMeta.training?.mode || trainingModeRequested || 'blocking');
  const shouldTrain = trainingMode !== 'off' && (installedNew || vectorIndexMissing);

  if (shouldTrain) {
    console.log("\n🔄 Training / indexing after external skill installs...");
    const endTrain = startSpan('external_skills_training');
    try {
      if (trainingMode === 'blocking') {
        const summary = await vectorIndex.rebuildIndex({ workspaceId, reposRoot: REPOS_ROOT });
        externalSkillsMeta.training.performed = true;
        externalSkillsMeta.training.blocking = true;
        externalSkillsMeta.training.summary = summary;
      } else if (trainingMode === 'background') {
        const scriptPath = path.join(__dirname, 'vector-index-rebuild.js');
        const child = spawn('node', [scriptPath], {
          cwd: path.join(__dirname, '..'),
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            REPOS_ROOT: REPOS_ROOT,
            CORTEX_WORKSPACE_ID: workspaceId || ''
          }
        });
        child.unref();
        externalSkillsMeta.training.performed = true;
        externalSkillsMeta.training.background = true;
        externalSkillsMeta.training.pid = child.pid || null;
      }
    } catch (e) {
      externalSkillsMeta.training.error = e.message;
    } finally {
      endTrain();
    }
  }

  // Step 3: Find relevant resources with tech filtering
  console.log("\n📚 Searching resources...");
  const endResourceSearch = startSpan('resource_search');
  let resources = await findResources(analysis, REPOS_ROOT, {
    maxResults: decisionConfig.maxCandidates || 5,
    minScore: 0.15,
    rrf: decisionConfig.rrf || {},
    ragFusion: decisionConfig.ragFusion || {},
    hyde: decisionConfig.hyde || {},
    hybrid: decisionConfig.hybridRetrieval || decisionConfig.hybrid || {},
    vectorIndex: config.vectorIndex || {},
    retrievalEnabled: retrievalGate.enabled,
    includeMeta: true,
    agentsMdPriority: decisionConfig.agentsMdPriority === true,
    workspaceId,
    stackProfile: config.stackProfile || {}
  });
  const resourceMeta = resources.__meta || {};
  decisionMeta.resourceSelection.rrfUsed = resourceMeta.rrfUsed === true;
  decisionMeta.resourceSelection.ragFusionUsed = resourceMeta.ragFusionUsed === true;
  decisionMeta.resourceSelection.ragFusionVariants = resourceMeta.ragFusionVariants;
  decisionMeta.resourceSelection.hydeUsed = resourceMeta.hydeUsed === true;
  decisionMeta.resourceSelection.hybridUsed = resourceMeta.hybridUsed === true;
  decisionMeta.resourceSelection.vectorIndexUsed = resourceMeta.vectorIndexUsed === true;
  if (resourceMeta.stackProfile) {
    decisionMeta.resourceSelection.stackProfile = resourceMeta.stackProfile;
  }

  const lateInteraction = rerankResourcesLate({
    goalText: goal,
    results: resources,
    config: decisionConfig.lateInteraction || {}
  });
  if (lateInteraction.used) {
    resources = lateInteraction.results;
    decisionMeta.resourceSelection.lateInteractionUsed = true;
  }
  let formatted = formatForFlightPlan(resources);

  const resourceStats = (() => {
    const scores = [];
    ['knowledge', 'skills', 'tools'].forEach((cat) => {
      (resources[cat] || []).forEach((item) => scores.push(item.score));
    });
    const topScore = scores.length ? Math.max(...scores) : 0;
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      totalCount: scores.length,
      topScore,
      avgScore
    };
  })();

  const allowResourceRerank =
    resourceRerankMode === 'always' ||
    resourceRerankMode === 'advisory' ||
    (resourceRerankMode !== 'never' &&
      retrievalGate.enabled &&
      (analysis.uncertainty.score >= llmRerankPolicy.minUncertainty ||
        resourceStats.topScore < llmRerankPolicy.minTopScore ||
        resourceStats.totalCount <= llmRerankPolicy.minResourceCount));

  decisionMeta.resourceSelection.rerankEligible = allowResourceRerank;
  if (allowResourceRerank) {
    const resourceRerank = await rerankResourcesLlm({
      goal,
      resourcesByCategory: formatted,
      llmConfig,
      decisionConfig
    });
    if (resourceRerank.used) {
      decisionMeta.resourceSelection.rerankUsed = true;
      formatted = resourceRerank.resourcesByCategory;
    }
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
    ragFusionUsed: decisionMeta.resourceSelection.ragFusionUsed,
    hydeUsed: decisionMeta.resourceSelection.hydeUsed,
    hybridUsed: decisionMeta.resourceSelection.hybridUsed,
    lateInteractionUsed: decisionMeta.resourceSelection.lateInteractionUsed,
    retrievalEnabled: decisionMeta.resourceSelection.retrievalEnabled,
    routingMode: resourceMeta.routingMode || analysis.routing.mode
  });
  endResourceSearch();

  // Step 4: Get agent template path
  const templatePath = getAgentTemplatePath(selectedAgent.agentId, AGENTS_DIR);

  // Step 5: Generate flight plan
  const decisionTrace = trace.finalize({
    selectedAgent: selectedAgent.agentId,
    resources: { knowledge: knowledgeCount, skills: skillsCount, tools: toolsCount }
  });
  decisionMeta.trace = decisionTrace;

  const endPlan = startSpan('generate_flight_plan');
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
    decisionMeta
  });
  endPlan();

  // Step 6: Save flight plan
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(OUTPUT_DIR, `spawned_agent_${timestamp}.md`);
  const endPersist = startSpan('persist_output');
  fs.writeFileSync(outPath, flightPlan);
  endPersist();

  console.log(`\n✅ FLIGHT PLAN GENERATED!`);
  console.log(`   Saved to: ${outPath}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n--- PREVIEW ---\n`);
  console.log(flightPlan);

  // Emit structured metadata for the API route to parse
  const meta = { performance: { totalMs: Date.now() - startedAt, spans } };
  console.log(`\n___CORTEX_META___${JSON.stringify(meta)}`);

  const durationMs = Date.now() - startedAt;
  const resourceTotal = knowledgeCount + skillsCount + toolsCount;
  const tokensEstimated = estimateTokens(flightPlan);
  const costEstimated = estimateCost(tokensEstimated, llmConfig);
  const qualityScore = computeQualityScore({
    uncertainty: analysis.uncertainty?.score,
    resourceTotal,
    retrievalEnabled: decisionMeta.resourceSelection.retrievalEnabled,
    lowConfidence: decisionMeta.agentSelection.lowConfidence,
    ambiguous: decisionMeta.agentSelection.ambiguous
  });

  const issues = [];
  const slowRunMs = decisionConfig.performance?.slowRunMs ?? 20000;
  if (durationMs > slowRunMs) issues.push('Slow run');
  if (!decisionMeta.resourceSelection.retrievalEnabled) issues.push('Retrieval gate skipped');
  if (resourceTotal === 0) issues.push('No resources matched');
  if (decisionMeta.agentSelection.lowConfidence) issues.push('Low agent confidence');
  if (decisionMeta.agentSelection.ambiguous) issues.push('Ambiguous top agent score');
  if (analysis.uncertainty?.score >= (decisionConfig.uncertainty?.requiresReviewThreshold ?? 0.6)) {
    issues.push('High uncertainty');
  }
  const observabilityConfig = config.observability || {};
  if (observabilityConfig.alertTokens && tokensEstimated > observabilityConfig.alertTokens) {
    issues.push('High token estimate');
  }
  if (observabilityConfig.alertCost && costEstimated > observabilityConfig.alertCost) {
    issues.push('High cost estimate');
  }

  const runRecord = {
    id: generateRunId(),
    timestamp: new Date().toISOString(),
    goal,
    format,
    workspaceId,
    durationMs,
    agent: {
      id: selectedAgent.agentId,
      name: selectedAgent.agentName
    },
    resources: {
      knowledge: knowledgeCount,
      skills: skillsCount,
      tools: toolsCount,
      total: resourceTotal
    },
    metrics: {
      tokensEstimated,
      costEstimated,
      currency: llmConfig.currency || 'USD',
      qualityScore,
      issues,
      uncertainty: analysis.uncertainty?.score ?? null,
      requiresReview: analysis.actions.requiresReview
    },
    usage: {
      tokensEstimated,
      costEstimated,
      currency: llmConfig.currency || 'USD'
    },
    decisionMatrix: decisionMeta,
    trace: decisionMeta.trace,
    performance: {
      totalMs: durationMs,
      spans
    },
    git: getGitMetadata(process.cwd()),
    outputPath: outPath,
    outputPreview: flightPlan.substring(0, 500)
  };

  try {
    recordRun(runRecord);
  } catch (e) {
    console.error('Failed to record run:', e.message);
  }

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
  const retrievalLabel = decisionMeta?.retrievalGate
    ? `${decisionMeta.retrievalGate.enabled ? 'enabled' : 'disabled'} (${decisionMeta.retrievalGate.reason || 'n/a'})`
    : 'n/a';
  const ragFusionLabel = decisionMeta?.resourceSelection?.ragFusionUsed
    ? `used (${decisionMeta.resourceSelection.ragFusionVariants || 0} variants)`
    : 'not used';
  const hydeLabel = decisionMeta?.resourceSelection?.hydeUsed ? 'used' : 'not used';
  const hybridLabel = decisionMeta?.resourceSelection?.hybridUsed ? 'enabled' : 'disabled';
  const vectorIndexLabel = decisionMeta?.resourceSelection?.vectorIndexUsed ? 'used' : 'not used';
  const lateInteractionLabel = decisionMeta?.resourceSelection?.lateInteractionUsed ? 'used' : 'not used';
  const llmPolicyLabel = decisionMeta?.agentSelection?.rerankPolicy || 'n/a';
  const agentRerankLabel = decisionMeta?.agentSelection?.rerankUsed
    ? (decisionMeta.agentSelection.rerankAccepted ? 'used (accepted)' : 'used (ignored)')
    : `not used${decisionMeta?.agentSelection?.rerankReason ? ` (${decisionMeta.agentSelection.rerankReason})` : ''}`;
  const resourceRerankLabel = decisionMeta?.resourceSelection?.rerankUsed ? 'used' : 'not used';
  const resourceRerankPolicyLabel = decisionMeta?.resourceSelection?.rerankPolicy || 'n/a';
  const externalSkillsLabel = (() => {
    const meta = decisionMeta?.resourceSelection?.externalSkills;
    if (!meta || meta.enabled !== true || meta.mode === 'off') return 'disabled';
    if (meta.skippedReason) return `skipped (${meta.skippedReason})`;
    if (meta.error) return `error (${meta.error})`;
    const installed = Array.isArray(meta.installed)
      ? meta.installed
          .filter(i => i && (i.installed || i.alreadyInstalled) && i.slug)
          .map(i => i.providerId ? `${i.providerId}:${i.slug}` : i.slug)
      : [];
    const training = meta.training?.mode ? `; training=${meta.training.mode}` : '';
    if (installed.length > 0) return `used (${meta.mode}${training}; ${installed.join(', ')})`;
    return `enabled (${meta.mode}${training})`;
  })();
  const stackProfileLabel = (() => {
    const profile = decisionMeta?.stackProfile;
    if (!profile || profile.enabled !== true) return 'disabled';
    const include = [
      ...(profile.include?.languages || []),
      ...(profile.include?.frameworks || []),
      ...(profile.include?.tools || []),
      ...(profile.include?.platforms || []),
      ...(profile.include?.tags || [])
    ].filter(Boolean);
    const includeLabel = include.length > 0 ? include.join(', ') : 'no tags';
    const exclude = Array.isArray(profile.exclude) ? profile.exclude.filter(Boolean) : [];
    const excludeLabel = exclude.length > 0 ? `; exclude ${exclude.join(', ')}` : '';
    return `${profile.mode || 'soft'} (${includeLabel}${excludeLabel})`;
  })();

  const decisionMatrixSection = decisionMeta
    ? `\n## 2.5 DECISION MATRIX\n\n- Instruction priority: ${decisionMeta.agentsMdPriority ? 'AGENTS.md first' : 'disabled'}\n- Retrieval gate: ${retrievalLabel}\n- External skills (online providers): ${externalSkillsLabel}\n- Stack profile: ${stackProfileLabel}\n- Query expansion: ${queryExpansionLabel}\n- RAG-Fusion: ${ragFusionLabel}\n- HyDE fallback: ${hydeLabel}\n- Hybrid retrieval: ${hybridLabel}\n- Semantic index: ${vectorIndexLabel}\n- Routing: ${routingLabel}\n- RRF fusion: ${decisionMeta.resourceSelection.rrfUsed ? 'enabled' : 'disabled'}\n- Late interaction rerank: ${lateInteractionLabel}\n- LLM agent mode: ${llmPolicyLabel}\n- LLM agent router: ${agentRerankLabel}\n- LLM resource mode: ${resourceRerankPolicyLabel}\n- Resource rerank: ${resourceRerankLabel}\n- Uncertainty: ${uncertaintyLabel}\n- Low confidence: ${decisionMeta.agentSelection.lowConfidence ? 'yes' : 'no'}\n- Ambiguous top score: ${decisionMeta.agentSelection.ambiguous ? 'yes' : 'no'}\n`
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
  .filter(([, v]) => v === true)
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

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

async function runCli() {
  const firstArg = process.argv[2];
  const useStdin = firstArg === '--stdin';
  const formatArg = process.argv[3] || 'universal';
  const goal = useStdin ? await readStdin() : firstArg;

  if (!goal || !goal.trim()) {
    console.error('Usage: node orchestrator.js "<User Goal>" [format]');
    console.error('   or: node orchestrator.js --stdin [format]');
    process.exit(1);
  }

  const result = await orchestrate(goal, formatArg);
  if (!result.success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error('Orchestrator failed:', error?.message || error);
    process.exit(1);
  });
}

module.exports = { orchestrate, analyzeGoal };
