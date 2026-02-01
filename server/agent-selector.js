/**
 * Agent Selector - Intelligent agent matching based on goal analysis
 * Uses multi-dimensional scoring with disambiguation rules
 */

const fs = require('fs');
const path = require('path');

// Enhanced agent profiles with disambiguation rules
const AGENT_PROFILES = {
  'std-agent': {
    id: 'std-agent',
    name: 'Standard Agent',
    description: 'Text-based agent for reasoning, coding, planning, and analysis.',

    // Multi-dimensional capability scoring
    capabilities: {
      primary: [
        { action: 'write_code', weight: 10, context: ['implementation', 'feature'] },
        { action: 'refactor_code', weight: 9, context: ['cleanup', 'optimize'] },
        { action: 'debug_code', weight: 9, context: ['fix', 'bug', 'error'] },
        { action: 'analyze', weight: 8, context: ['review', 'audit'] },
        { action: 'plan', weight: 8, context: ['design', 'architecture'] }
      ],
      secondary: [
        { action: 'test_code', weight: 7, context: ['unit', 'integration'] },
        { action: 'document', weight: 6, context: ['readme', 'docs'] }
      ]
    },

    // Tool requirements
    tools: {
      required: ['filesystem', 'terminal'],
      optional: ['api'],
      incompatible: []
    },

    // Domain expertise (0-10)
    domains: {
      frontend: 9,
      backend: 9,
      devops: 6,
      security: 5,
      testing: 8,
      documentation: 7,
      data: 6,
      automation: 3
    },

    // Task type affinity (0-10)
    taskTypes: {
      research: 6,
      implementation: 10,
      testing: 8,
      debugging: 9,
      refactoring: 9,
      review: 7,
      documentation: 6,
      planning: 7,
      automation: 2
    },

    // Complexity handling
    complexity: {
      optimal: 'moderate',
      range: ['trivial', 'simple', 'moderate', 'complex'],
      maxParallelTasks: 3
    },

    // Disambiguation rules - CRITICAL for correct selection
    disambiguation: {
      strongSignals: [
        { pattern: /\b(implement|code|function|class|component|api)\b/i, boost: 30 },
        { pattern: /\b(refactor|clean\s*up\s*code|optimize\s*code)\b/i, boost: 25 },
        { pattern: /\b(bug|fix|debug|error)\b/i, boost: 20 },
        { pattern: /\b(test|tdd|unit\s*test)\b/i, boost: 15 }
      ],
      weakSignals: [
        { pattern: /\b(improve|enhance|update)\b/i, boost: 10 }
      ],
      negativeSignals: [
        { pattern: /\b(browser|click|screenshot|scrape|crawl)\b/i, penalty: 40 },
        { pattern: /\b(navigate|automate\s*gui|selenium|playwright)\b/i, penalty: 35 }
      ],
      contextualRules: [
        {
          // "Clean up UI" with code context = development, NOT GUI automation
          condition: goal => /\bui\b/i.test(goal) && /\b(code|component|refactor|cleanup|clean\s*up)\b/i.test(goal) && !/\bbrowser\b/i.test(goal),
          action: 'boost',
          value: 50,
          reason: 'UI code work is development, not GUI automation'
        },
        {
          // Explicit code context
          condition: goal => /\b(code|function|class|module|file)\b/i.test(goal),
          action: 'boost',
          value: 20,
          reason: 'Explicit code context detected'
        }
      ]
    }
  },

  'Agent-S': {
    id: 'Agent-S',
    name: 'Agent-S',
    description: 'Generalist OS Agent for GUI, Browser, and Desktop interaction.',

    capabilities: {
      primary: [
        { action: 'automate_browser', weight: 10, context: ['browser', 'web', 'page'] },
        { action: 'click_elements', weight: 10, context: ['click', 'button', 'link'] },
        { action: 'screenshot', weight: 9, context: ['screenshot', 'capture', 'visual'] },
        { action: 'scrape', weight: 9, context: ['scrape', 'crawl', 'extract'] }
      ],
      secondary: [
        { action: 'fill_forms', weight: 7, context: ['form', 'input'] },
        { action: 'navigate', weight: 7, context: ['navigate', 'page'] }
      ]
    },

    tools: {
      required: ['browser', 'gui'],
      optional: ['filesystem'],
      incompatible: []
    },

    domains: {
      frontend: 4,
      backend: 1,
      devops: 2,
      security: 2,
      testing: 5,
      documentation: 1,
      data: 3,
      automation: 10
    },

    taskTypes: {
      research: 3,
      implementation: 2,
      testing: 5,
      debugging: 2,
      refactoring: 1,
      review: 2,
      documentation: 2,
      planning: 2,
      automation: 10
    },

    complexity: {
      optimal: 'moderate',
      range: ['simple', 'moderate'],
      maxParallelTasks: 1
    },

    disambiguation: {
      strongSignals: [
        { pattern: /\b(browser|chrome|firefox|selenium|playwright|puppeteer)\b/i, boost: 50 },
        { pattern: /\b(click|screenshot|automate\s*gui|mouse|keyboard)\b/i, boost: 45 },
        { pattern: /\b(scrape|crawl|extract\s*from\s*page)\b/i, boost: 40 },
        { pattern: /\b(fill\s*form|submit\s*form|login\s*to\s*website)\b/i, boost: 35 },
        { pattern: /\b(navigate\s*to|open\s*page|visit\s*website)\b/i, boost: 30 }
      ],
      weakSignals: [
        { pattern: /\b(visual|page|website)\b/i, boost: 10 }
      ],
      negativeSignals: [
        // CRITICAL: Prevent false matches on code tasks
        { pattern: /\b(refactor|cleanup\s*code|optimize\s*code|clean\s*up\s*code)\b/i, penalty: 60 },
        { pattern: /\b(implement|function|class|component|module)\b/i, penalty: 50 },
        { pattern: /\b(test\s*code|unit\s*test|tdd|write\s*tests)\b/i, penalty: 40 },
        { pattern: /\bui\s*(code|component|refactor|cleanup)\b/i, penalty: 55 }
      ],
      contextualRules: [
        {
          // UI without browser = code work
          condition: goal => /\bui\b/i.test(goal) && !/\b(browser|click|automate|scrape)\b/i.test(goal),
          action: 'penalty',
          value: 50,
          reason: 'UI without automation context likely means UI code'
        },
        {
          // "clean" without browser = code cleanup
          condition: goal => /\bclean/i.test(goal) && !/\bbrowser\b/i.test(goal),
          action: 'penalty',
          value: 40,
          reason: 'Clean without browser context means code cleanup'
        }
      ]
    }
  }
};

/**
 * Load agent profiles from disk if they have enhanced configs
 */
function loadAgentProfiles(agentsDir) {
  const profiles = { ...AGENT_PROFILES };

  if (!agentsDir || !fs.existsSync(agentsDir)) {
    return profiles;
  }

  const agentDirs = fs.readdirSync(agentsDir).filter(f => {
    const fullPath = path.join(agentsDir, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
  });

  agentDirs.forEach(dir => {
    const enhancedConfigPath = path.join(agentsDir, dir, 'agent.profile.json');

    if (fs.existsSync(enhancedConfigPath)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(enhancedConfigPath, 'utf8'));
        profiles[dir] = { ...profiles[dir], ...loaded };
      } catch (e) {
        console.error(`Error loading enhanced profile for ${dir}:`, e.message);
      }
    }
  });

  return profiles;
}

/**
 * Score an agent against the analyzed goal
 */
function scoreAgent(agent, analyzedGoal) {
  const breakdown = {
    intentMatch: 0,
    domainExpertise: 0,
    taskTypeAffinity: 0,
    capabilityMatch: 0,
    complexityFit: 0,
    signalBoosts: 0,
    signalPenalties: 0,
    contextualRules: 0
  };
  const reasons = [];

  // 1. Intent Match (25%)
  const intentScore = scoreIntentMatch(agent, analyzedGoal.intent);
  breakdown.intentMatch = intentScore * 25;
  if (intentScore > 0.5) {
    reasons.push(`Intent match: ${analyzedGoal.intent.primary}`);
  }

  // 2. Domain Expertise (20%)
  const domainScore = scoreDomainExpertise(agent, analyzedGoal.techStack);
  breakdown.domainExpertise = domainScore * 20;

  // 3. Task Type Affinity (15%)
  const taskScore = scoreTaskTypeAffinity(agent, analyzedGoal.intent.primary);
  breakdown.taskTypeAffinity = taskScore * 15;

  // 4. Capability Match (15%)
  const capScore = scoreCapabilityMatch(agent, analyzedGoal.capabilities);
  breakdown.capabilityMatch = capScore * 15;
  if (capScore < 0.5) {
    reasons.push('Missing required capabilities');
  }

  // 5. Complexity Fit (5%)
  const complexityScore = scoreComplexityFit(agent, analyzedGoal.complexity.level);
  breakdown.complexityFit = complexityScore * 5;

  // 6. Signal Processing (20% total)
  const signalResult = processSignals(agent, analyzedGoal.originalGoal);
  breakdown.signalBoosts = signalResult.boosts;
  breakdown.signalPenalties = -signalResult.penalties;
  reasons.push(...signalResult.reasons);

  // 7. Contextual Rules
  const contextResult = applyContextualRules(agent, analyzedGoal.originalGoal);
  breakdown.contextualRules = contextResult.adjustment;
  reasons.push(...contextResult.reasons);

  const totalScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const normalizedScore = Math.max(0, Math.min(100, totalScore));
  const confidence = calculateConfidence(breakdown, normalizedScore);

  return {
    agentId: agent.id,
    agentName: agent.name,
    description: agent.description,
    score: normalizedScore,
    confidence,
    breakdown,
    reasons: reasons.filter(r => r)
  };
}

function scoreIntentMatch(agent, intent) {
  const intentToTaskType = {
    coding: 'implementation',
    debugging: 'debugging',
    refactoring: 'refactoring',
    testing: 'testing',
    research: 'research',
    documentation: 'documentation',
    automation: 'automation',
    deployment: 'automation',
    security: 'review'
  };

  const taskType = intentToTaskType[intent.primary] || 'implementation';
  const affinity = agent.taskTypes[taskType] || 5;
  return affinity / 10;
}

function scoreDomainExpertise(agent, techStack) {
  const detectedPlatforms = techStack.platforms || [];
  const detectedFrameworks = techStack.frameworks || [];
  const inferred = techStack.inferred || [];

  let totalScore = 0;
  let count = 0;

  // Check frontend/backend inference
  if (detectedPlatforms.includes('web') || inferred.includes('frontend') ||
      detectedFrameworks.some(f => ['react', 'vue', 'nextjs'].includes(f))) {
    totalScore += agent.domains.frontend || 0;
    count++;
  }

  if (inferred.includes('backend') || detectedFrameworks.some(f => ['express', 'fastapi', 'django'].includes(f))) {
    totalScore += agent.domains.backend || 0;
    count++;
  }

  if (count === 0) return 0.5; // Neutral if no domains detected
  return (totalScore / count) / 10;
}

function scoreTaskTypeAffinity(agent, intentPrimary) {
  const mapping = {
    coding: 'implementation',
    debugging: 'debugging',
    refactoring: 'refactoring',
    testing: 'testing',
    research: 'research',
    documentation: 'documentation',
    automation: 'automation'
  };

  const taskType = mapping[intentPrimary] || 'implementation';
  return (agent.taskTypes[taskType] || 5) / 10;
}

function scoreCapabilityMatch(agent, requiredCapabilities) {
  let matched = 0;
  let required = 0;

  for (const [cap, needed] of Object.entries(requiredCapabilities)) {
    if (needed === true) {
      required++;
      const hasCapability = agent.tools.required.includes(cap) ||
                           agent.tools.optional.includes(cap) ||
                           (cap === 'fileSystem' && agent.tools.required.includes('filesystem')) ||
                           (cap === 'browser' && agent.tools.required.includes('browser')) ||
                           (cap === 'gui' && agent.tools.required.includes('gui'));

      if (hasCapability) matched++;
    }
  }

  if (required === 0) return 0.7; // Neutral if no specific capabilities needed
  return matched / required;
}

function scoreComplexityFit(agent, complexityLevel) {
  const range = agent.complexity.range || ['simple', 'moderate'];
  if (range.includes(complexityLevel)) {
    return agent.complexity.optimal === complexityLevel ? 1.0 : 0.8;
  }
  return 0.4;
}

function processSignals(agent, goal) {
  let boosts = 0;
  let penalties = 0;
  const reasons = [];

  const disambiguation = agent.disambiguation || {};

  // Strong signals
  for (const signal of disambiguation.strongSignals || []) {
    if (signal.pattern.test(goal)) {
      boosts += signal.boost;
      reasons.push(`Strong signal matched (+${signal.boost})`);
    }
  }

  // Weak signals
  for (const signal of disambiguation.weakSignals || []) {
    if (signal.pattern.test(goal)) {
      boosts += signal.boost;
    }
  }

  // Negative signals
  for (const signal of disambiguation.negativeSignals || []) {
    if (signal.pattern.test(goal)) {
      penalties += signal.penalty;
      reasons.push(`Negative signal: -${signal.penalty}`);
    }
  }

  return { boosts, penalties, reasons };
}

function applyContextualRules(agent, goal) {
  let adjustment = 0;
  const reasons = [];

  const rules = agent.disambiguation?.contextualRules || [];

  for (const rule of rules) {
    if (typeof rule.condition === 'function' && rule.condition(goal)) {
      if (rule.action === 'boost') {
        adjustment += rule.value;
        reasons.push(`Context: ${rule.reason} (+${rule.value})`);
      } else if (rule.action === 'penalty') {
        adjustment -= rule.value;
        reasons.push(`Context: ${rule.reason} (-${rule.value})`);
      }
    }
  }

  return { adjustment, reasons };
}

function calculateConfidence(breakdown, totalScore) {
  const positiveDimensions = Object.values(breakdown).filter(v => v > 5).length;
  const negativeDimensions = Object.values(breakdown).filter(v => v < -10).length;

  let confidence = totalScore / 100;

  if (positiveDimensions >= 4) confidence += 0.15;
  else if (positiveDimensions >= 3) confidence += 0.10;

  confidence -= negativeDimensions * 0.1;

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Main entry point - select best agent for analyzed goal
 */
function selectAgent(analyzedGoal, agentsDir = null) {
  const profiles = loadAgentProfiles(agentsDir);
  const agents = Object.values(profiles);

  const scoredAgents = agents.map(agent => scoreAgent(agent, analyzedGoal));
  scoredAgents.sort((a, b) => b.score - a.score);

  const result = {
    selected: scoredAgents[0],
    alternatives: scoredAgents.slice(1),
    warnings: {}
  };

  // Check confidence
  if (scoredAgents[0].confidence < 0.4) {
    result.warnings.lowConfidence = {
      message: 'No strong agent match found. Consider clarifying the goal.',
      topScore: scoredAgents[0].score
    };
  }

  // Check for ambiguity
  if (scoredAgents.length > 1 && scoredAgents[0].score - scoredAgents[1].score < 15) {
    result.warnings.ambiguous = {
      message: 'Multiple agents scored similarly.',
      agents: [scoredAgents[0].agentId, scoredAgents[1].agentId]
    };
  }

  return result;
}

module.exports = {
  selectAgent,
  scoreAgent,
  loadAgentProfiles,
  AGENT_PROFILES
};
