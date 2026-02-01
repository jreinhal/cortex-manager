/**
 * Goal Analyzer - Semantic understanding of user goals
 * Extracts intent, tech stack, complexity, and required capabilities
 */

const { expandGoalVariants } = require('./query-expander');

// Intent patterns with weights
const INTENT_PATTERNS = {
  coding: {
    verbs: ['create', 'add', 'implement', 'build', 'write', 'develop', 'make', 'code'],
    nouns: ['feature', 'component', 'function', 'class', 'module', 'page', 'endpoint', 'api'],
    weight: 1.0
  },
  debugging: {
    verbs: ['fix', 'debug', 'solve', 'resolve', 'repair', 'troubleshoot', 'investigate'],
    nouns: ['bug', 'error', 'issue', 'problem', 'crash', 'exception', 'failure'],
    modifiers: ['broken', 'failing', 'not working', 'crashing'],
    weight: 1.2
  },
  refactoring: {
    verbs: ['refactor', 'clean', 'improve', 'optimize', 'restructure', 'modernize', 'simplify'],
    nouns: ['code', 'codebase', 'architecture', 'structure'],
    modifiers: ['legacy', 'messy', 'old', 'technical debt', 'cleanup'],
    weight: 1.0
  },
  testing: {
    verbs: ['test', 'verify', 'validate', 'check', 'assert', 'cover'],
    nouns: ['test', 'spec', 'coverage', 'suite', 'assertion', 'scenario'],
    modifiers: ['unit', 'integration', 'e2e', 'end-to-end'],
    weight: 1.1
  },
  research: {
    verbs: ['find', 'search', 'research', 'look up', 'explore', 'discover', 'learn'],
    nouns: ['best practice', 'approach', 'solution', 'library', 'tool', 'framework'],
    modifiers: ['how to', 'what is', 'why does', 'compare'],
    weight: 0.9
  },
  documentation: {
    verbs: ['document', 'describe', 'explain', 'write'],
    nouns: ['docs', 'documentation', 'readme', 'api docs', 'jsdoc', 'comment'],
    weight: 1.0
  },
  analysis: {
    verbs: ['analyze', 'review', 'assess', 'evaluate', 'critique', 'inspect'],
    nouns: ['ui', 'ux', 'design', 'interface', 'usability', 'experience', 'standards', 'guidelines', 'heuristics'],
    modifiers: ['user experience', 'accessibility', 'a11y', 'design review', 'heuristic'],
    weight: 1.2
  },
  automation: {
    verbs: ['automate', 'script', 'scrape', 'crawl', 'navigate', 'click'],
    nouns: ['browser', 'page', 'website', 'workflow', 'gui', 'screenshot'],
    modifiers: ['selenium', 'playwright', 'puppeteer'],
    weight: 1.0
  },
  deployment: {
    verbs: ['deploy', 'release', 'publish', 'ship', 'push', 'rollout'],
    nouns: ['production', 'staging', 'server', 'cloud', 'container'],
    modifiers: ['to prod', 'to production', 'live'],
    weight: 1.1
  },
  security: {
    verbs: ['secure', 'audit', 'scan', 'pentest', 'harden'],
    nouns: ['security', 'vulnerability', 'auth', 'permission', 'encryption'],
    modifiers: ['owasp', 'cve', 'exploit'],
    weight: 1.2
  }
};

// Technology taxonomy
const TECH_TAXONOMY = {
  languages: {
    javascript: {
      explicit: ['javascript', 'js', 'ecmascript', 'es6'],
      related: ['node', 'npm', 'yarn', 'pnpm']
    },
    typescript: {
      explicit: ['typescript', 'ts'],
      related: ['tsc', 'tsconfig', 'types']
    },
    python: {
      explicit: ['python', 'py', 'python3'],
      related: ['pip', 'poetry', 'conda', 'venv']
    },
    rust: {
      explicit: ['\\brust\\b', '\\brs\\b'],
      related: ['cargo', 'crate'],
      useRegex: true
    },
    go: {
      explicit: ['golang', 'go'],
      related: ['go mod']
    }
  },
  frameworks: {
    react: {
      explicit: ['react', 'reactjs'],
      signals: ['jsx', 'tsx', 'hooks', 'usestate', 'useeffect', 'component'],
      implies: ['javascript', 'frontend']
    },
    nextjs: {
      explicit: ['next', 'nextjs', 'next.js'],
      signals: ['app router', 'pages router', 'server component'],
      implies: ['react', 'javascript', 'fullstack']
    },
    vue: {
      explicit: ['vue', 'vuejs'],
      signals: ['composition api', 'ref', 'reactive', 'nuxt'],
      implies: ['javascript', 'frontend']
    },
    express: {
      explicit: ['express', 'expressjs'],
      signals: ['middleware', 'router'],
      implies: ['javascript', 'nodejs', 'backend']
    },
    fastapi: {
      explicit: ['fastapi'],
      signals: ['pydantic', 'uvicorn'],
      implies: ['python', 'backend']
    },
    django: {
      explicit: ['django'],
      implies: ['python', 'backend']
    },
    flask: {
      explicit: ['flask'],
      implies: ['python', 'backend']
    }
  },
  tools: {
    docker: ['docker', 'dockerfile', 'container', 'compose'],
    kubernetes: ['kubernetes', 'k8s', 'kubectl', 'helm'],
    git: ['git', 'github', 'gitlab', 'commit', 'branch', 'pr', 'pull request'],
    database: ['sql', 'postgres', 'mysql', 'mongodb', 'redis', 'prisma'],
    testing: ['jest', 'vitest', 'pytest', 'mocha', 'playwright', 'cypress'],
    bundler: ['webpack', 'vite', 'rollup', 'esbuild']
  },
  platforms: {
    web: ['web', 'browser', 'frontend', 'front end', 'front-end', 'ui', 'ux', 'interface', 'client-side', 'spa'],
    mobile: ['mobile', 'ios', 'android', 'react native', 'flutter'],
    cli: ['cli', 'command line', 'terminal', 'shell'],
    api: ['api', 'rest', 'graphql', 'backend', 'server'],
    desktop: ['desktop', 'electron', 'tauri']
  }
};

// Keyword filtering
const KEYWORD_STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'function', 'const', 'let', 'var', 'return', 'import', 'export',
  'true', 'false', 'null', 'undefined', 'class', 'new', 'self',
  // Generic noise terms
  'best', 'practice', 'practices', 'guide', 'guides', 'overview', 'intro', 'introduction',
  'reference', 'references', 'pattern', 'patterns', 'template', 'templates', 'example', 'examples',
  'sample', 'samples', 'misc', 'general', 'notes', 'note', 'docs', 'documentation', 'readme',
  'skill', 'skills', 'knowledge', 'tool', 'tools', 'resource', 'resources',
  'repo', 'repos', 'repository', 'repositories', 'project', 'projects',
  'app', 'apps', 'application', 'applications',
  'top', 'standard', 'standards', 'industry', 'software', 'focus', 'precise', 'results', 'using', 'borrow', 'user', 'experience'
]);

const KEYWORD_ALLOWLIST = new Set([
  'ui', 'ux', 'ai', 'ml', 'db', 'qa', 'os', 'ci', 'cd', 'js', 'ts', 'go', 'api', 'sql', 'a11y', 'ef'
]);

const DEFAULT_QUERY_EXPANSION = {
  maxVariants: 4
};

const DEFAULT_ROUTING_CONFIG = {
  minKeywordCount: 2,
  highRecallKeywordCount: 6,
  noResourceKeywordCount: 0,
  lowConfidenceThreshold: 0.35
};

const DEFAULT_UNCERTAINTY_CONFIG = {
  requiresReviewThreshold: 0.6,
  highComplexityPenalty: 0.1,
  lowKeywordPenalty: 0.2,
  lowTechPenalty: 0.12,
  shortGoalPenalty: 0.08,
  minKeywordCount: 2
};

// Action verb analysis
const ACTION_VERBS = {
  create: { type: 'create', destructive: false, requiresReview: false },
  add: { type: 'create', destructive: false, requiresReview: false },
  implement: { type: 'create', destructive: false, requiresReview: false },
  build: { type: 'create', destructive: false, requiresReview: false },
  update: { type: 'modify', destructive: false, requiresReview: false },
  change: { type: 'modify', destructive: false, requiresReview: false },
  refactor: { type: 'modify', destructive: false, requiresReview: true },
  migrate: { type: 'modify', destructive: true, requiresReview: true },
  delete: { type: 'delete', destructive: true, requiresReview: true },
  remove: { type: 'delete', destructive: true, requiresReview: true },
  clean: { type: 'delete', destructive: true, requiresReview: true },
  fix: { type: 'repair', destructive: false, requiresReview: false },
  debug: { type: 'repair', destructive: false, requiresReview: false },
  analyze: { type: 'analyze', destructive: false, requiresReview: false },
  review: { type: 'analyze', destructive: false, requiresReview: false },
  deploy: { type: 'execute', destructive: true, requiresReview: true },
  run: { type: 'execute', destructive: false, requiresReview: false }
};

// Complexity indicators
const COMPLEXITY_INDICATORS = {
  trivial: {
    patterns: [/fix\s+typo/i, /update\s+version/i, /change\s+(?:color|text|label)/i, /rename\s+\w+/i],
    maxSteps: 2
  },
  simple: {
    patterns: [/add\s+(?:a\s+)?(?:button|field|input)/i, /fix\s+(?:small|minor)\s+bug/i, /update\s+(?:readme|docs)/i],
    maxSteps: 5
  },
  moderate: {
    patterns: [/implement\s+(?:a\s+)?(?:feature|component)/i, /add\s+(?:api|endpoint)/i, /refactor\s+(?:the\s+)?\w+/i],
    maxSteps: 15
  },
  complex: {
    patterns: [/redesign/i, /migrate/i, /full\s+rewrite/i, /integrate/i, /authentication/i],
    maxSteps: 40
  },
  epic: {
    patterns: [/build\s+(?:a\s+)?(?:complete|full|entire)/i, /architect/i, /system\s+design/i],
    maxSteps: 100
  }
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textIncludesTerm(text, term) {
  if (!term) return false;
  if (term.includes(' ')) return text.includes(term);
  if (term.length <= 2) {
    return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text);
  }
  return text.includes(term);
}

/**
 * Classify the primary intent of the goal
 */
function classifyIntent(goal) {
  const normalizedGoal = goal.toLowerCase();
  const scores = {};

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;

    patterns.verbs.forEach(verb => {
      if (normalizedGoal.includes(verb)) score += 3 * patterns.weight;
    });

    patterns.nouns.forEach(noun => {
      if (normalizedGoal.includes(noun)) score += 2 * patterns.weight;
    });

    if (patterns.modifiers) {
      patterns.modifiers.forEach(mod => {
        if (normalizedGoal.includes(mod)) score += 1.5 * patterns.weight;
      });
    }

    scores[intent] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const maxScore = sorted[0][1];

  return {
    primary: sorted[0][0],
    secondary: sorted.slice(1, 3).filter(([_, s]) => s > maxScore * 0.5).map(([i]) => i),
    confidence: maxScore > 0 ? Math.min(maxScore / 10, 1.0) : 0.1,
    scores
  };
}

/**
 * Detect tech stack from goal text
 */
function detectTechStack(goal) {
  const normalizedGoal = goal.toLowerCase();
  const detected = {
    languages: [],
    frameworks: [],
    tools: [],
    platforms: [],
    inferred: []
  };

  // Detect languages
  for (const [lang, config] of Object.entries(TECH_TAXONOMY.languages)) {
    let found = false;
    if (config.useRegex) {
      found = config.explicit.some(term => new RegExp(term, 'i').test(normalizedGoal)) ||
              config.related.some(term => textIncludesTerm(normalizedGoal, term));
    } else {
      found = config.explicit.some(term => textIncludesTerm(normalizedGoal, term)) ||
              config.related.some(term => textIncludesTerm(normalizedGoal, term));
    }
    if (found) detected.languages.push(lang);
  }

  // Detect frameworks and their implications
  for (const [fw, config] of Object.entries(TECH_TAXONOMY.frameworks)) {
    const found = config.explicit.some(term => textIncludesTerm(normalizedGoal, term)) ||
                  (config.signals && config.signals.some(term => textIncludesTerm(normalizedGoal, term)));
    if (found) {
      detected.frameworks.push(fw);
      if (config.implies) {
        config.implies.forEach(implied => {
          if (!detected.languages.includes(implied) &&
              !detected.inferred.includes(implied) &&
              !detected.frameworks.includes(implied)) {
            detected.inferred.push(implied);
          }
        });
      }
    }
  }

  // Detect tools
  for (const [tool, terms] of Object.entries(TECH_TAXONOMY.tools)) {
    if (terms.some(term => textIncludesTerm(normalizedGoal, term))) {
      detected.tools.push(tool);
    }
  }

  // Detect platforms
  for (const [platform, terms] of Object.entries(TECH_TAXONOMY.platforms)) {
    if (terms.some(term => textIncludesTerm(normalizedGoal, term))) {
      detected.platforms.push(platform);
    }
  }

  return detected;
}

/**
 * Analyze action verbs in the goal
 */
function analyzeActions(goal) {
  const normalizedGoal = goal.toLowerCase();
  const words = normalizedGoal.split(/\s+/);

  let primaryVerb = null;
  let actionType = 'unknown';
  let isDestructive = false;
  let requiresReview = false;

  for (const word of words) {
    if (ACTION_VERBS[word]) {
      primaryVerb = word;
      const config = ACTION_VERBS[word];
      actionType = config.type;
      isDestructive = config.destructive;
      requiresReview = config.requiresReview;
      break;
    }
  }

  // Escalate for certain keywords
  if (normalizedGoal.includes('production') || normalizedGoal.includes('all') || normalizedGoal.includes('entire')) {
    requiresReview = true;
  }

  return {
    primaryVerb: primaryVerb || 'unknown',
    actionType,
    isDestructive,
    requiresReview
  };
}

/**
 * Assess task complexity
 */
function assessComplexity(goal, intent, techStack) {
  const normalizedGoal = goal.toLowerCase();
  let level = 'moderate';
  let estimatedSteps = 10;
  const indicators = [];
  const risks = [];

  // Check complexity patterns
  for (const [complexity, config] of Object.entries(COMPLEXITY_INDICATORS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(normalizedGoal)) {
        level = complexity;
        estimatedSteps = config.maxSteps;
        indicators.push(`Matched pattern: ${pattern.source}`);
        break;
      }
    }
  }

  // Apply multipliers
  if (normalizedGoal.includes('entire') || normalizedGoal.includes('all')) {
    estimatedSteps = Math.round(estimatedSteps * 1.8);
    indicators.push('Scope expansion detected');
  }

  if (normalizedGoal.includes('production')) {
    risks.push('Affects production environment');
  }

  if (normalizedGoal.includes('database') || normalizedGoal.includes('migration')) {
    risks.push('Database changes - backup recommended');
  }

  // Adjust level based on final steps
  if (estimatedSteps <= 2) level = 'trivial';
  else if (estimatedSteps <= 5) level = 'simple';
  else if (estimatedSteps <= 15) level = 'moderate';
  else if (estimatedSteps <= 40) level = 'complex';
  else level = 'epic';

  return { level, estimatedSteps, indicators, risks };
}

/**
 * Map required capabilities
 */
function mapCapabilities(goal, intent, techStack) {
  const normalizedGoal = goal.toLowerCase();
  const capabilities = {
    fileSystem: false,
    browser: false,
    api: false,
    database: false,
    terminal: false,
    gui: false,
    specific: []
  };

  // Browser/GUI detection
  if (/browser|screenshot|click|navigate|scrape|crawl|automate\s*gui/i.test(normalizedGoal)) {
    capabilities.browser = true;
    capabilities.gui = true;
  }

  // File system (default for coding tasks)
  if (['coding', 'refactoring', 'debugging', 'analysis', 'documentation', 'testing'].includes(intent.primary)) {
    capabilities.fileSystem = true;
  }

  // API detection
  if (/api|endpoint|fetch|request|http/i.test(normalizedGoal)) {
    capabilities.api = true;
  }

  // Database detection
  if (techStack.tools.includes('database') || /database|sql|query|migration/i.test(normalizedGoal)) {
    capabilities.database = true;
  }

  // Terminal detection
  if (/command|terminal|shell|npm|yarn|pip/i.test(normalizedGoal) || intent.primary === 'deployment') {
    capabilities.terminal = true;
  }

  return capabilities;
}

/**
 * Extract keywords for backward compatibility and resource matching
 */
function extractKeywords(goal, techStack) {
  const goalLower = goal.toLowerCase();
  const basicTokens = goalLower
    .replace(/c\+\+/g, 'cpp')
    .replace(/c#/g, 'csharp')
    .replace(/\.net/g, 'dotnet')
    .replace(/node\.js/g, 'nodejs')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => {
      if (!t) return false;
      if (KEYWORD_STOP_WORDS.has(t)) return false;
      if (t.length > 2) return true;
      return KEYWORD_ALLOWLIST.has(t);
    });

  // Phrase-aware additions
  const keywordSet = new Set(basicTokens);
  if (/user\s+interface/.test(goalLower)) keywordSet.add('ui');
  if (/user\s+experience/.test(goalLower)) keywordSet.add('ux');
  if (/front\s*end/.test(goalLower)) keywordSet.add('frontend');
  if (/back\s*end/.test(goalLower)) keywordSet.add('backend');
  if (/accessibility|a11y/.test(goalLower)) keywordSet.add('accessibility');

  const techTerms = [
    ...techStack.languages,
    ...techStack.frameworks,
    ...techStack.tools,
    ...techStack.platforms,
    ...techStack.inferred
  ];

  const combined = [...new Set([...techTerms, ...keywordSet])];

  // Sort: tech terms first, then by length
  return combined.sort((a, b) => {
    const aIsTech = techTerms.includes(a) ? 1 : 0;
    const bIsTech = techTerms.includes(b) ? 1 : 0;
    if (aIsTech !== bIsTech) return bIsTech - aIsTech;
    return b.length - a.length;
  });
}

function expandKeywords(goal, techStack, options) {
  const variants = expandGoalVariants(goal, options);
  if (!variants.length) {
    return { variants: [], expandedKeywords: [] };
  }

  const keywordSet = new Set();
  variants.forEach((variant) => {
    extractKeywords(variant, techStack).forEach((kw) => keywordSet.add(kw));
  });

  return {
    variants,
    expandedKeywords: Array.from(keywordSet)
  };
}

function computeGoalSignals(goal, keywords, expandedKeywords, techStack) {
  const wordCount = goal.split(/\s+/).filter(Boolean).length;
  const techSignals = [
    ...(techStack.languages || []),
    ...(techStack.frameworks || []),
    ...(techStack.tools || []),
    ...(techStack.platforms || []),
    ...(techStack.inferred || [])
  ];

  return {
    wordCount,
    keywordCount: keywords.length,
    expandedKeywordCount: expandedKeywords.length,
    keywordDensity: wordCount > 0 ? keywords.length / wordCount : 0,
    hasTechStack: techSignals.length > 0,
    techSignalCount: techSignals.length
  };
}

function determineRouting(analysis, signals, config) {
  const routing = {
    mode: 'DOCUMENT',
    reasons: []
  };

  if (signals.keywordCount <= config.noResourceKeywordCount && !signals.hasTechStack) {
    routing.mode = 'NO_RESOURCES';
    routing.reasons.push('No keywords or tech signals detected');
    return routing;
  }

  if (analysis.intent.confidence < config.lowConfidenceThreshold) {
    routing.mode = 'HIGH_RECALL';
    routing.reasons.push('Low intent confidence');
  }

  if (signals.expandedKeywordCount >= config.highRecallKeywordCount) {
    routing.mode = 'HIGH_RECALL';
    routing.reasons.push('High keyword coverage');
  }

  if (['complex', 'epic'].includes(analysis.complexity.level)) {
    routing.mode = 'HIGH_RECALL';
    routing.reasons.push('Complexity suggests broader retrieval');
  }

  if (routing.reasons.length === 0) {
    routing.reasons.push('Default document retrieval');
  }

  return routing;
}

function computeUncertainty(analysis, signals, routing, config) {
  let score = 1 - analysis.intent.confidence;
  const reasons = ['Base: intent confidence'];

  if (signals.keywordCount < config.minKeywordCount) {
    score += config.lowKeywordPenalty;
    reasons.push('Low keyword count');
  }

  if (!signals.hasTechStack) {
    score += config.lowTechPenalty;
    reasons.push('No tech stack signals');
  }

  if (signals.wordCount < 6) {
    score += config.shortGoalPenalty;
    reasons.push('Very short goal text');
  }

  if (['complex', 'epic'].includes(analysis.complexity.level)) {
    score += config.highComplexityPenalty;
    reasons.push('High complexity');
  }

  if (routing.mode === 'NO_RESOURCES') {
    score += 0.2;
    reasons.push('No-resources routing');
  }

  score = Math.max(0, Math.min(1, score));

  return {
    score,
    reasons
  };
}

/**
 * Main entry point - analyzes a goal and returns structured metadata
 */
function analyzeGoal(goalText, options = {}) {
  if (!goalText || typeof goalText !== 'string') {
    throw new Error('goalText must be a non-empty string');
  }

  const normalizedGoal = goalText.trim();
  const decisionConfig = options.decisionConfig || {};
  const queryExpansionConfig = { ...DEFAULT_QUERY_EXPANSION, ...(decisionConfig.queryExpansion || {}) };
  const routingConfig = { ...DEFAULT_ROUTING_CONFIG, ...(decisionConfig.routing || {}) };
  const uncertaintyConfig = { ...DEFAULT_UNCERTAINTY_CONFIG, ...(decisionConfig.uncertainty || {}) };

  const intent = classifyIntent(normalizedGoal);
  const techStack = detectTechStack(normalizedGoal);
  const actions = analyzeActions(normalizedGoal);
  const complexity = assessComplexity(normalizedGoal, intent, techStack);
  const capabilities = mapCapabilities(normalizedGoal, intent, techStack);
  const keywords = extractKeywords(normalizedGoal, techStack);
  const expansion = expandKeywords(normalizedGoal, techStack, queryExpansionConfig);
  const expandedKeywordSet = new Set([...keywords, ...expansion.expandedKeywords]);
  const expandedKeywords = Array.from(expandedKeywordSet);
  const signals = computeGoalSignals(normalizedGoal, keywords, expandedKeywords, techStack);
  const routing = determineRouting({ intent, complexity }, signals, routingConfig);
  const uncertainty = computeUncertainty({ intent, complexity }, signals, routing, uncertaintyConfig);

  if (uncertainty.score >= uncertaintyConfig.requiresReviewThreshold) {
    actions.requiresReview = true;
  }

  return {
    intent,
    techStack,
    actions,
    complexity,
    capabilities,
    keywords,
    expandedKeywords,
    queryExpansion: {
      variants: expansion.variants,
      expandedKeywordCount: expandedKeywords.length
    },
    routing,
    uncertainty,
    signals,
    originalGoal: normalizedGoal,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = {
  analyzeGoal,
  classifyIntent,
  detectTechStack,
  analyzeActions,
  assessComplexity,
  mapCapabilities,
  extractKeywords,
  determineRouting,
  computeUncertainty
};
