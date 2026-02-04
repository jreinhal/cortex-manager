/**
 * Resource Matcher - Smart resource finding with tech stack filtering
 * and multi-signal relevance scoring
 */

const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');
const vectorIndex = require('./vector-index');

// Tech stack detection from file extensions and content
const TECH_DETECTION = {
  extensions: {
    '.jsx': ['react', 'javascript', 'frontend'],
    '.tsx': ['react', 'typescript', 'frontend'],
    '.vue': ['vue', 'javascript', 'frontend'],
    '.svelte': ['svelte', 'javascript', 'frontend'],
    '.py': ['python'],
    '.rs': ['rust'],
    '.go': ['golang'],
    '.rb': ['ruby'],
    '.java': ['java'],
    '.cs': ['csharp', 'dotnet'],
    '.sh': ['bash', 'shell', 'devops'],
    '.ps1': ['powershell', 'windows', 'devops'],
    '.yaml': ['yaml', 'devops'],
    '.yml': ['yaml', 'devops'],
    '.tf': ['terraform', 'devops'],
    '.dockerfile': ['docker', 'devops']
  },
  contentPatterns: {
    'import.*react|from.*react': ['react', 'frontend'],
    'from fastapi|import fastapi': ['fastapi', 'python', 'backend'],
    'from flask|import flask': ['flask', 'python', 'backend'],
    'from django|import django': ['django', 'python', 'backend'],
    'express\\(\\)|require.*express': ['express', 'nodejs', 'backend'],
    'import.*from.*next': ['nextjs', 'react', 'fullstack'],
    'tailwindcss|@tailwind': ['tailwind', 'css', 'frontend'],
    'prisma|@prisma/client': ['prisma', 'database', 'orm'],
    'mongoose|mongodb': ['mongodb', 'database'],
    'jest|vitest|mocha|pytest': ['testing'],
    'docker-compose|kubernetes': ['devops', 'containers'],
    'openai|anthropic|langchain': ['ai', 'llm']
  },
  filePatterns: {
    'package.json': ['nodejs', 'javascript'],
    'requirements.txt': ['python'],
    'pyproject.toml': ['python'],
    'Cargo.toml': ['rust'],
    'go.mod': ['golang'],
    'Dockerfile': ['docker', 'devops'],
    'tailwind.config': ['tailwind', 'css', 'frontend'],
    'vite.config': ['vite', 'frontend'],
    'tsconfig.json': ['typescript'],
    'jest.config': ['jest', 'testing'],
    'playwright.config': ['playwright', 'e2e', 'testing']
  }
};

// Domain classification
const DOMAIN_PATTERNS = {
  directoryPatterns: {
    'components|ui|views|pages': ['frontend', 'ui'],
    'design|ux|ui': ['ui', 'ux', 'design', 'frontend'],
    'api|routes|controllers|handlers': ['backend', 'api'],
    'models|entities|schemas': ['backend', 'data-modeling'],
    'utils|helpers|lib': ['utilities'],
    'tests|__tests__|spec': ['testing'],
    'scripts|bin': ['devops', 'automation'],
    'docs|documentation': ['documentation'],
    'auth|authentication': ['security', 'auth']
  },
  contentKeywords: {
    'authentication|login|jwt|oauth': ['security', 'auth'],
    'api|endpoint|rest|graphql': ['api', 'backend'],
    'database|query|orm|sql': ['database'],
    'test|spec|assert|mock': ['testing'],
    'deploy|ci|cd|pipeline': ['devops', 'ci-cd'],
    'component|render|state|props': ['frontend', 'ui'],
    'ui|ux|design|interface|usability|accessibility|a11y': ['ui', 'ux', 'design', 'frontend'],
    'prompt|agent|llm|completion': ['ai', 'llm']
  }
};

// Stop words to filter from keywords
const STOP_WORDS = new Set([
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

const GOAL_DOMAIN_KEYWORDS = {
  ui: ['ui', 'ux', 'design', 'interface', 'usability', 'accessibility', 'a11y', 'user experience', 'visual'],
  security: ['security', 'vulnerability', 'vulnerabilities', 'owasp', 'pentest', 'auth', 'audit'],
  backend: ['backend', 'server', 'api'],
  database: ['database', 'sql', 'orm', 'query'],
  devops: ['devops', 'deploy', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes'],
  testing: ['test', 'testing', 'qa', 'unit', 'integration', 'e2e'],
  documentation: ['docs', 'documentation', 'readme'],
  performance: ['performance', 'optimize', 'latency', 'speed']
};

const UI_PREFERRED_PATTERNS = [
  /guidelines?/i,
  /standards?/i,
  /design\s*system/i,
  /design-system/i,
  /\bhig\b/i,
  /human\s*interface/i,
  /material\s*design/i,
  /\bone\s*ui\b/i,
  /\bapple\b/i,
  /\bgoogle\b/i,
  /\bsamsung\b/i,
  /\bios\b/i,
  /\bandroid\b/i,
  /style\s*guide/i,
  /styleguide/i,
  /ui\s*kit/i,
  /accessibility|a11y/i
];

const AGENTS_FILE_NAME = 'agents.md';
const INSTRUCTION_BOOST = 0.35;
const GENERIC_GOAL_KEYWORDS = new Set([
  'agent', 'agents', 'skill', 'skills', 'knowledge', 'tool', 'tools',
  'repo', 'repos', 'repository', 'repositories', 'selection', 'prompt', 'prompts'
]);

const RRF_DEFAULT = {
  enabled: true,
  k: 60,
  weight: 0.45
};

const RAG_FUSION_DEFAULT = {
  enabled: false,
  k: 60,
  weight: 0.5,
  includeOriginal: true,
  maxVariants: 4
};

const HYDE_DEFAULT = {
  enabled: false,
  mode: 'fallback', // 'fallback' | 'always'
  minResults: 3,
  minScore: 0.35
};

const HYBRID_DEFAULT = {
  enabled: false,
  semanticWeight: 0.35,
  minSemanticScore: 0.05
};

const DOC_EXTENSIONS = ['.md', '.mdx', '.txt', '.rst', '.adoc', '.org', '.markdown'];
const DATA_EXTENSIONS = [...DOC_EXTENSIONS, '.json', '.yaml', '.yml'];
const TOOL_EXTENSIONS = [...DATA_EXTENSIONS, '.js', '.ts', '.py', '.sh'];

/**
 * Walk directory recursively
 */
function walkDirectory(dir, fileList = [], options = {}) {
  const IGNORE = ['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', 'coverage', '_system'];
  const allowedExtensions = options.allowedExtensions || DATA_EXTENSIONS;

  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (IGNORE.includes(file) || file.startsWith('.')) return;

    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDirectory(filePath, fileList, options);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (!allowedExtensions || allowedExtensions.includes(ext)) {
          fileList.push(filePath);
        }
      }
    } catch (e) {
      // Skip inaccessible files
    }
  });
  return fileList;
}

/**
 * Detect tech stack from file
 */
function detectFileTechStack(filePath, content = '') {
  const tags = new Set();
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();

  // Extension-based detection
  const extTags = TECH_DETECTION.extensions[ext];
  if (extTags) extTags.forEach(t => tags.add(t));

  // Filename-based detection
  for (const [pattern, fileTags] of Object.entries(TECH_DETECTION.filePatterns)) {
    if (fileName.includes(pattern.toLowerCase())) {
      fileTags.forEach(t => tags.add(t));
    }
  }

  // Content-based detection
  if (content) {
    for (const [pattern, contentTags] of Object.entries(TECH_DETECTION.contentPatterns)) {
      if (new RegExp(pattern, 'i').test(content)) {
        contentTags.forEach(t => tags.add(t));
      }
    }
  }

  return Array.from(tags);
}

/**
 * Detect domains from file
 */
function detectFileDomains(filePath, content = '') {
  const tags = new Set();
  const pathLower = filePath.toLowerCase();

  // Directory-based detection
  for (const [pattern, dirTags] of Object.entries(DOMAIN_PATTERNS.directoryPatterns)) {
    if (new RegExp(pattern, 'i').test(pathLower)) {
      dirTags.forEach(t => tags.add(t));
    }
  }

  // Content keyword detection
  if (content) {
    for (const [pattern, contentTags] of Object.entries(DOMAIN_PATTERNS.contentKeywords)) {
      if (new RegExp(pattern, 'i').test(content)) {
        contentTags.forEach(t => tags.add(t));
      }
    }
  }

  return Array.from(tags);
}

/**
 * Extract keywords from content
 */
function extractKeywords(content, fileName) {
  const fileTokens = fileName
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(t => (t.length > 2 || KEYWORD_ALLOWLIST.has(t)) && !STOP_WORDS.has(t));

  const contentWords = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => (w.length > 3 || KEYWORD_ALLOWLIST.has(w)) && !STOP_WORDS.has(w));

  // Count frequency
  const wordCount = {};
  contentWords.forEach(w => {
    wordCount[w] = (wordCount[w] || 0) + 1;
  });

  const topContent = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  return [...new Set([...fileTokens, ...topContent])].slice(0, 30);
}

function tokenizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => {
      if (!t) return false;
      if (STOP_WORDS.has(t)) return false;
      if (t.length > 2) return true;
      return KEYWORD_ALLOWLIST.has(t);
    });
}

function extractGoalKeywordsFromText(goalText, techStack = []) {
  const tokens = tokenizeText(goalText);
  const combined = new Set(tokens);
  techStack.forEach((t) => {
    if (t) combined.add(t.toLowerCase());
  });
  return Array.from(combined);
}

function buildHydeDocument(goalText, analyzedGoal) {
  const intent = analyzedGoal.intent?.primary || 'task';
  const techStack = [
    ...(analyzedGoal.techStack?.languages || []),
    ...(analyzedGoal.techStack?.frameworks || []),
    ...(analyzedGoal.techStack?.tools || []),
    ...(analyzedGoal.techStack?.platforms || []),
    ...(analyzedGoal.techStack?.inferred || [])
  ].filter(Boolean);

  const keywords = analyzedGoal.expandedKeywords || analyzedGoal.keywords || [];
  const focus = keywords.slice(0, 12).join(', ');
  const tech = techStack.length > 0 ? `Technology stack: ${techStack.join(', ')}.` : '';

  return `Hypothetical document describing a ${intent} objective. ${goalText}. ${tech} Key topics include ${focus}.`;
}

function computeSemanticScore(goalText, resource) {
  if (!goalText || !resource) return 0;
  if (typeof resource.semanticScoreOverride === 'number') {
    return Math.max(0, Math.min(1, resource.semanticScoreOverride));
  }
  const docText = `${resource.fileName || ''} ${resource.relativePath || ''} ${resource.summary || ''}`.trim();
  if (!docText) return 0;

  const goal = goalText.toLowerCase();
  const doc = docText.toLowerCase();
  const similarity = stringSimilarity.compareTwoStrings(goal, doc);
  const goalTokens = new Set(tokenizeText(goal));
  const docTokens = new Set(tokenizeText(doc));
  let overlap = 0;
  goalTokens.forEach((token) => {
    if (docTokens.has(token)) overlap += 1;
  });
  const overlapRatio = goalTokens.size > 0 ? overlap / goalTokens.size : 0;

  return Math.max(similarity, overlapRatio);
}

function extractPathTokens(value) {
  return value
    .replace(/\\/g, '/')
    .split(/[\/._-]+/)
    .map(t => t.toLowerCase())
    .filter(t => {
      if (!t) return false;
      if (STOP_WORDS.has(t)) return false;
      if (t.length > 2) return true;
      return KEYWORD_ALLOWLIST.has(t);
    });
}

function filterGoalKeywords(keywords) {
  const filtered = (keywords || [])
    .map(kw => kw.toLowerCase())
    .filter((kw) => !GENERIC_GOAL_KEYWORDS.has(kw));
  return [...new Set(filtered)];
}

function goalExplicitlyRequestsAgents(goalText) {
  if (!goalText) return false;
  return /agents?\.md/i.test(goalText) || /\bagents? instructions\b/i.test(goalText);
}

function analyzePathSignals(relativePath, fileName) {
  const normalized = relativePath.toLowerCase().replace(/\\/g, '/');
  const entryPointPatterns = /(readme|skill|template|index)\.md$/;
  const isEntryPoint = entryPointPatterns.test(fileName.toLowerCase()) || entryPointPatterns.test(normalized);
  const isReference = /\/references?\//.test(normalized) || /\/ref(erence)?\//.test(normalized);
  const isExample = /\/examples?\//.test(normalized) || /\/samples?\//.test(normalized);
  const isDocsDir = /\/docs?\//.test(normalized) || /\/documentation\//.test(normalized);
  const isAgents = fileName.toLowerCase() === AGENTS_FILE_NAME || normalized.endsWith(`/${AGENTS_FILE_NAME}`);

  let priority = 0.6;
  if (isEntryPoint) priority += 0.35;
  if (isDocsDir) priority += 0.1;
  if (isReference) priority -= 0.35;
  if (isExample) priority -= 0.15;
  if (isAgents) priority = 1.0;

  priority = Math.max(0, Math.min(1, priority));

  return { priority, isEntryPoint, isReference, isExample, isDocsDir, isAgents };
}

/**
 * Extract summary from content
 */
function extractSummary(content) {
  let text = content.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/[#*_`\[\]]/g, '');

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20);

  return lines.slice(0, 3).join(' ').substring(0, 300);
}

function deriveGoalDomains(analyzedGoal) {
  const domains = new Set();
  const normalizedGoal = (analyzedGoal.originalGoal || '').toLowerCase();
  const keywords = analyzedGoal.expandedKeywords || analyzedGoal.keywords || [];

  (analyzedGoal.techStack?.platforms || []).forEach(d => domains.add(d));

  for (const [domain, terms] of Object.entries(GOAL_DOMAIN_KEYWORDS)) {
    const matched = terms.some(term => {
      if (term.includes(' ')) return normalizedGoal.includes(term);
      return keywords.includes(term) || normalizedGoal.includes(term);
    });
    if (matched) domains.add(domain);
  }

  return Array.from(domains);
}

function computePreferenceBoost(resource, analyzedGoal, techContext) {
  const targetDomains = techContext.domains || [];
  if (!targetDomains.includes('ui')) return 0;
  if (!resource || (resource.category !== 'skills' && resource.category !== 'knowledge')) return 0;

  const goalText = (analyzedGoal.originalGoal || '').toLowerCase();
  const haystack = `${resource.relativePath} ${resource.fileName} ${resource.summary || ''}`.toLowerCase();
  let matches = 0;
  UI_PREFERRED_PATTERNS.forEach((pattern) => {
    if (pattern.test(haystack)) matches += 1;
  });

  if (matches === 0) return 0;

  const mentionsBrands = /(apple|google|samsung|material|one\s*ui|human\s*interface|\bhig\b)/i.test(goalText);
  const baseBoost = matches * 0.06;
  const skillBonus = resource.category === 'skills' ? 0.02 : 0;
  const brandBonus = mentionsBrands ? 0.04 : 0;

  // Small, capped boost to keep overall scoring stable
  return Math.min(0.24, baseBoost + skillBonus + brandBonus);
}

/**
 * Check if tech stacks are compatible
 */
function isTechCompatible(resourceTech, targetTech) {
  if (!targetTech || targetTech.length === 0) return true;

  const TECH_RELATIONS = {
    'typescript': ['javascript', 'nodejs'],
    'javascript': ['typescript', 'nodejs'],
    'react': ['javascript', 'typescript', 'frontend'],
    'vue': ['javascript', 'typescript', 'frontend'],
    'nextjs': ['react', 'nodejs', 'fullstack'],
    'express': ['nodejs', 'javascript', 'backend'],
    'fastapi': ['python', 'backend', 'api'],
    'django': ['python', 'backend'],
    'flask': ['python', 'backend']
  };

  // Resource has matching tech
  const hasMatch = resourceTech.some(tech =>
    targetTech.includes(tech) ||
    (TECH_RELATIONS[tech] && TECH_RELATIONS[tech].some(r => targetTech.includes(r)))
  );

  // Or resource is tech-agnostic (markdown without specific tech)
  const isTechAgnostic = resourceTech.length === 0;

  return hasMatch || isTechAgnostic;
}

/**
 * Score a resource against the analyzed goal
 */
function scoreResource(resource, analyzedGoal, techContext) {
  const weights = {
    filenameMatch: 0.22,
    keywordMatch: 0.18,
    techStackBonus: 0.18,
    domainBonus: 0.12,
    contentMatch: 0.10,
    quality: 0.10,
    pathPriority: 0.10
  };

  const keywords = analyzedGoal.expandedKeywords || analyzedGoal.keywords || [];
  const targetTech = techContext.techStack || [];
  const targetDomains = techContext.domains || [];
  const negativeDomains = techContext.negativeDomains || [];
  const hybridConfig = techContext.hybrid || { enabled: false };

  // Filename match - with word boundary checking
  let filenameScore = 0;
  const fileNameLower = resource.fileName.toLowerCase();
  const fileNameTokens = resource.fileNameTokens || fileNameLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/);
  const pathTokens = resource.pathTokens || [];

  keywords.forEach(kw => {
    const kwLower = kw.toLowerCase();
    // Exact token match (higher score)
    if (fileNameTokens.includes(kwLower)) {
      filenameScore += 2;
    }
    // Directory/path match (medium score)
    else if (pathTokens.includes(kwLower)) {
      filenameScore += 1.2;
    }
    // Substring match (lower score)
    else if (fileNameLower.includes(kwLower)) {
      filenameScore += 0.5;
    }
  });
  filenameScore = Math.min(1, filenameScore / Math.max(keywords.length, 1));

  // Keyword match
  let keywordScore = 0;
  const resourceKeywords = new Set(resource.keywords.map(k => k.toLowerCase()));
  keywords.forEach(kw => {
    if (resourceKeywords.has(kw.toLowerCase())) keywordScore++;
  });
  keywordScore = keywords.length > 0 ? keywordScore / keywords.length : 0;

  // Tech stack match
  let techScore = 0.5; // Neutral default
  if (targetTech.length > 0) {
    const matches = resource.techStack.filter(t => targetTech.includes(t)).length;
    techScore = matches / targetTech.length;
  }

  // Domain match
  let domainScore = 0.5; // Neutral default
  if (targetDomains.length > 0) {
    const matches = resource.domains.filter(d => targetDomains.includes(d)).length;
    domainScore = matches / targetDomains.length;
  }

  // Content match (summary contains keywords)
  let contentScore = 0;
  const summaryLower = (resource.summary || '').toLowerCase();
  keywords.forEach(kw => {
    if (summaryLower.includes(kw.toLowerCase())) contentScore += 0.5;
  });
  contentScore = Math.min(1, contentScore / Math.max(keywords.length, 1));

  // Quality score (based on file size - not empty, not huge)
  const fileSize = resource.fileSize || 0;
  let qualityScore = 0.5;
  if (fileSize > 500 && fileSize < 100000) qualityScore = 0.8;
  if (fileSize > 2000 && fileSize < 50000) qualityScore = 1.0;

  // Path priority (entrypoints > docs > references/examples)
  const pathPriority = resource.pathSignals?.priority ?? 0.6;
  const instructionBoost = resource.pathSignals?.isAgents ? INSTRUCTION_BOOST : 0;

  const preferenceBoost = computePreferenceBoost(resource, analyzedGoal, techContext);

  // Domain penalty for explicitly excluded domains
  let domainPenalty = 0;
  if (negativeDomains.length > 0 && resource.domains.some(d => negativeDomains.includes(d))) {
    domainPenalty = 0.2;
  }
  if (targetDomains.length > 0 && resource.domains.length > 0 && !resource.domains.some(d => targetDomains.includes(d))) {
    domainPenalty += 0.15;
  }

  // Calculate total
  const total =
    filenameScore * weights.filenameMatch +
    keywordScore * weights.keywordMatch +
    techScore * weights.techStackBonus +
    domainScore * weights.domainBonus +
    contentScore * weights.contentMatch +
    qualityScore * weights.quality +
    pathPriority * weights.pathPriority +
    instructionBoost +
    preferenceBoost -
    domainPenalty;

  const sparseScore = Math.max(0, Math.min(1, total));
  const semanticScore = Math.max(
    hybridConfig.minSemanticScore ?? 0,
    computeSemanticScore(analyzedGoal.originalGoal, resource)
  );

  let finalScore = sparseScore;
  if (hybridConfig.enabled) {
    const semanticWeight = Math.min(0.9, Math.max(0, hybridConfig.semanticWeight ?? 0.35));
    finalScore = (1 - semanticWeight) * sparseScore + semanticWeight * semanticScore;
  }

  return {
    score: Math.max(0, Math.min(1, finalScore)),
    sparseScore,
    semanticScore,
    breakdown: {
      filename: filenameScore,
      keywords: keywordScore,
      techStack: techScore,
      domains: domainScore,
      content: contentScore,
      quality: qualityScore,
      pathPriority,
      instructionBoost,
      preferenceBoost,
      domainPenalty,
      sparse: sparseScore,
      semantic: semanticScore
    }
  };
}

function applyRrfFusion(items, config) {
  if (!config.enabled || items.length < 2) {
    return { used: false, items };
  }

  const metrics = [
    { name: 'weighted', accessor: (item) => item.score },
    { name: 'filename', accessor: (item) => item.breakdown.filename },
    { name: 'keywords', accessor: (item) => item.breakdown.keywords },
    { name: 'tech', accessor: (item) => item.breakdown.techStack },
    { name: 'domains', accessor: (item) => item.breakdown.domains },
    { name: 'content', accessor: (item) => item.breakdown.content },
    { name: 'path', accessor: (item) => item.breakdown.pathPriority }
  ];

  if (config.includeHybrid) {
    metrics.push(
      { name: 'sparse', accessor: (item) => item.sparseScore ?? item.breakdown.sparse ?? item.score },
      { name: 'semantic', accessor: (item) => item.semanticScore ?? item.breakdown.semantic ?? 0 }
    );
  }

  const rankMaps = {};
  metrics.forEach((metric) => {
    const sorted = [...items].sort((a, b) => metric.accessor(b) - metric.accessor(a));
    const map = new Map();
    sorted.forEach((item, idx) => {
      map.set(item.filePath, idx + 1);
    });
    rankMaps[metric.name] = map;
  });

  items.forEach((item) => {
    let rrfScore = 0;
    metrics.forEach((metric) => {
      const rank = rankMaps[metric.name].get(item.filePath) || items.length;
      rrfScore += 1 / (config.k + rank);
    });
    item.rrfScore = rrfScore;
  });

  const scores = items.map((i) => i.rrfScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  items.forEach((item) => {
    const normalized = range > 0 ? (item.rrfScore - minScore) / range : 0.5;
    item.rrfNormalized = normalized;
    item.scoreRaw = item.score;
    item.score = Math.max(0, Math.min(1, (1 - config.weight) * item.scoreRaw + config.weight * normalized));
  });

  return { used: true, items };
}

function applyRagFusion(variantLists, config) {
  if (!config.enabled || variantLists.length < 2) {
    return { used: false, items: variantLists[0] ? [...variantLists[0]] : [] };
  }

  const map = new Map();
  variantLists.forEach((list) => {
    list.forEach((item, idx) => {
      const rank = idx + 1;
      const entry = map.get(item.filePath) || {
        ...item,
        ragFusionScore: 0,
        maxVariantScore: item.score
      };
      entry.ragFusionScore += 1 / (config.k + rank);
      if (item.score > entry.maxVariantScore) {
        entry.maxVariantScore = item.score;
        entry.breakdown = item.breakdown;
        entry.sparseScore = item.sparseScore;
        entry.semanticScore = item.semanticScore;
        entry.summary = item.summary;
      }
      map.set(item.filePath, entry);
    });
  });

  const items = Array.from(map.values());
  const scores = items.map((i) => i.ragFusionScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  items.forEach((item) => {
    const normalized = range > 0 ? (item.ragFusionScore - minScore) / range : 0.5;
    item.ragFusionNormalized = normalized;
    const baseScore = item.maxVariantScore ?? item.score;
    item.score = (1 - config.weight) * baseScore + config.weight * normalized;
  });

  return { used: true, items };
}

function buildResourceIndex(files, reposRoot, cat, semanticLookup) {
  return files.map((filePath) => {
    let content = '';
    try {
      const buffer = fs.readFileSync(filePath);
      if (buffer.length < 50000) {
        content = buffer.toString('utf8').substring(0, 10000);
      }
    } catch {
      // Skip unreadable files
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const relativePath = path.relative(reposRoot, filePath);
    const pathTokens = extractPathTokens(relativePath);
    const fileNameTokens = extractPathTokens(fileName);
    const pathSignals = analyzePathSignals(relativePath, fileName);

    const keywords = extractKeywords(content, fileName);
    const mergedKeywords = [...new Set([...keywords, ...pathTokens])];

    return {
      filePath,
      relativePath,
      fileName,
      category: cat,
      techStack: detectFileTechStack(filePath, content),
      domains: detectFileDomains(filePath, content),
      keywords: mergedKeywords,
      pathTokens,
      fileNameTokens,
      pathSignals,
      isInstruction: pathSignals.isAgents,
      summary: extractSummary(content),
      fileSize: stat.size,
      semanticScoreOverride: semanticLookup ? (semanticLookup.get(filePath) || null) : null
    };
  });
}

function scoreResourcesForGoal(resources, analyzedGoal, techContext, options) {
  const categoryMinScore = options.categoryMinScore ?? 0.15;
  const hasInstructionSignal = options.hasInstructionSignal;

  const scored = resources.map((resource) => {
    if (!isTechCompatible(resource.techStack, techContext.techStack)) {
      return null;
    }

    const scoring = scoreResource(resource, analyzedGoal, techContext);
    return {
      ...resource,
      score: scoring.score,
      sparseScore: scoring.sparseScore,
      semanticScore: scoring.semanticScore,
      breakdown: scoring.breakdown
    };
  }).filter((resource) => {
    if (!resource) return false;
    if (!resource.isInstruction) return resource.score >= categoryMinScore;
    return hasInstructionSignal ? hasInstructionSignal(resource) : true;
  });

  scored.sort((a, b) => {
    if (a.isInstruction !== b.isInstruction) return a.isInstruction ? -1 : 1;
    return b.score - a.score;
  });

  return scored;
}

function resolveRoutingOptions(analyzedGoal, options) {
  const baseMaxResults = options.maxResults ?? 10;
  const baseMinScore = options.minScore ?? 0.15;
  const routingMode = analyzedGoal.routing?.mode || 'DOCUMENT';

  if (routingMode === 'NO_RESOURCES') {
    return { maxResults: 0, minScore: 1, routingMode };
  }

  if (routingMode === 'HIGH_RECALL') {
    return {
      maxResults: Math.max(baseMaxResults, 12),
      minScore: Math.max(0.08, baseMinScore - 0.05),
      routingMode
    };
  }

  return { maxResults: baseMaxResults, minScore: baseMinScore, routingMode };
}

/**
 * Main entry point - find relevant resources
 */
async function findResources(analyzedGoal, reposRoot, options = {}) {
  const {
    category = null,
    rrf = {},
    includeMeta = false,
    agentsMdPriority = false,
    retrievalEnabled = true,
    ragFusion = {},
    hyde = {},
    hybrid = {},
    vectorIndex: vectorConfig = {}
  } = options;

  const results = {
    knowledge: [],
    skills: [],
    tools: []
  };

  if (retrievalEnabled === false) {
    if (includeMeta) {
      results.__meta = {
        retrievalDisabled: true,
        rrfUsed: false,
        ragFusionUsed: false,
        hydeUsed: false,
        hybridUsed: false,
        routingMode: analyzedGoal.routing?.mode || 'DOCUMENT'
      };
    }
    return results;
  }

  const routingOptions = resolveRoutingOptions(analyzedGoal, options);
  const maxResults = routingOptions.maxResults;
  const minScore = routingOptions.minScore;
  const rrfConfig = { ...RRF_DEFAULT, ...(rrf || {}) };
  const ragFusionConfig = { ...RAG_FUSION_DEFAULT, ...(ragFusion || {}) };
  const hydeConfig = { ...HYDE_DEFAULT, ...(hyde || {}) };
  const hybridConfig = { ...HYBRID_DEFAULT, ...(hybrid || {}) };
  rrfConfig.includeHybrid = hybridConfig.enabled === true;
  if (!ragFusionConfig.k) {
    ragFusionConfig.k = rrfConfig.k;
  }
  const vectorEnabled = vectorConfig?.enabled === true;

  const intent = analyzedGoal.intent?.primary || 'coding';
  const goalKeywords = analyzedGoal.expandedKeywords || analyzedGoal.keywords || [];
  const includeTools = intent === 'automation' ||
    intent === 'deployment' ||
    analyzedGoal.capabilities?.terminal ||
    goalKeywords.includes('tool') ||
    goalKeywords.includes('cli');

  const categories = category
    ? [category]
    : (includeTools ? ['knowledge', 'skills', 'tools'] : ['knowledge', 'skills']);

  const goalDomains = deriveGoalDomains(analyzedGoal);
  const goalText = analyzedGoal.originalGoal || '';
  const filteredGoalKeywords = filterGoalKeywords(goalKeywords);
  const techContext = {
    techStack: [
      ...(analyzedGoal.techStack?.languages || []),
      ...(analyzedGoal.techStack?.frameworks || []),
      ...(analyzedGoal.techStack?.inferred || [])
    ],
    domains: goalDomains,
    negativeDomains: goalDomains.includes('security') ? [] : ['security'],
    hybrid: hybridConfig
  };

  const allowAllInstructions = goalExplicitlyRequestsAgents(goalText) ||
    (agentsMdPriority && (filteredGoalKeywords.length > 0 || goalDomains.length > 0 || techContext.techStack.length > 0));

  const hasInstructionSignal = (resource) => {
    if (allowAllInstructions) return true;

    const keywordHit = filteredGoalKeywords.some((kw) => resource.keywords?.includes(kw));
    if (keywordHit) return true;

    if (techContext.domains.length > 0) {
      const domainHit = resource.domains?.some((d) => techContext.domains.includes(d));
      if (domainHit) return true;
    }

    if (techContext.techStack.length > 0) {
      const techHit = resource.techStack?.some((t) => techContext.techStack.includes(t));
      if (techHit) return true;
    }

    const summary = (resource.summary || '').toLowerCase();
    return filteredGoalKeywords.some((kw) => summary.includes(kw));
  };

  const techStackTokens = [
    ...(analyzedGoal.techStack?.languages || []),
    ...(analyzedGoal.techStack?.frameworks || []),
    ...(analyzedGoal.techStack?.tools || []),
    ...(analyzedGoal.techStack?.platforms || []),
    ...(analyzedGoal.techStack?.inferred || [])
  ];
  const baseKeywordSeed = analyzedGoal.expandedKeywords || analyzedGoal.keywords || [];

  let variantTexts = [goalText];
  if (ragFusionConfig.enabled && Array.isArray(analyzedGoal.queryExpansion?.variants)) {
    const variants = analyzedGoal.queryExpansion.variants.slice(0, ragFusionConfig.maxVariants);
    variantTexts = ragFusionConfig.includeOriginal ? variantTexts.concat(variants) : variants;
  }
  variantTexts = Array.from(new Set(variantTexts.map(v => v && v.trim()).filter(Boolean)));
  if (variantTexts.length === 0) {
    variantTexts = [goalText];
  }

  const variantGoals = variantTexts.map((variantText) => {
    const variantKeywords = extractGoalKeywordsFromText(variantText, techStackTokens);
    const merged = [...new Set([...baseKeywordSeed, ...variantKeywords])];
    return {
      ...analyzedGoal,
      originalGoal: variantText,
      keywords: merged,
      expandedKeywords: merged
    };
  });

  let semanticLookup = null;
  let vectorUsed = false;
  if (vectorEnabled) {
    const vectorResults = await vectorIndex.search(goalText, {
      topK: Math.max(12, maxResults * 4),
      workspaceId: options.workspaceId,
      reposRoot
    });
    semanticLookup = new Map();
    vectorResults.forEach((result) => {
      const current = semanticLookup.get(result.filePath) || 0;
      if (result.score > current) semanticLookup.set(result.filePath, result.score);
    });
    vectorUsed = vectorResults.length > 0;
  }

  const resourceIndex = {};
  categories.forEach((cat) => {
    const catDir = path.join(reposRoot, cat);
    if (!fs.existsSync(catDir)) {
      resourceIndex[cat] = [];
      return;
    }
    const allowedExtensions = cat === 'tools'
      ? TOOL_EXTENSIONS
      : (cat === 'skills' ? DOC_EXTENSIONS : DATA_EXTENSIONS);
    const files = walkDirectory(catDir, [], { allowedExtensions });
    resourceIndex[cat] = buildResourceIndex(files, reposRoot, cat, semanticLookup);
  });

  const variantListsByCategory = {};
  categories.forEach((cat) => {
    variantListsByCategory[cat] = [];
  });

  const categoryMinScoreMap = {
    knowledge: minScore + 0.05,
    tools: minScore + 0.1,
    skills: minScore
  };

  variantGoals.forEach((variantGoal) => {
    categories.forEach((cat) => {
      const categoryMinScore = categoryMinScoreMap[cat] ?? minScore;
      const list = scoreResourcesForGoal(
        resourceIndex[cat] || [],
        variantGoal,
        techContext,
        { categoryMinScore, hasInstructionSignal }
      );
      variantListsByCategory[cat].push(list);
    });
  });

  const computeResults = () => {
    const computed = { knowledge: [], skills: [], tools: [] };
    const meta = { rrfUsed: false, ragFusionUsed: false };
    categories.forEach((cat) => {
      const lists = variantListsByCategory[cat] || [];
      const ragFusionEnabled = ragFusionConfig.enabled || lists.length > 1;
      const ragFusion = applyRagFusion(lists, { ...ragFusionConfig, enabled: ragFusionEnabled });
      meta.ragFusionUsed = meta.ragFusionUsed || ragFusion.used;

      const fusion = applyRrfFusion(ragFusion.items, rrfConfig);
      meta.rrfUsed = meta.rrfUsed || fusion.used;
      computed[cat] = fusion.items.slice(0, maxResults);
    });
    return { computed, meta };
  };

  let { computed, meta } = computeResults();
  let hydeUsed = false;

  if (hydeConfig.enabled) {
    const scored = [...(computed.knowledge || []), ...(computed.skills || [])];
    const totalMatches = scored.length;
    const topScore = scored.length > 0 ? Math.max(...scored.map(r => r.score)) : 0;
    const needsHyde = hydeConfig.mode === 'always' ||
      totalMatches < hydeConfig.minResults ||
      topScore < hydeConfig.minScore;

    if (needsHyde) {
      const hydeText = buildHydeDocument(goalText, analyzedGoal);
      const hydeKeywords = extractGoalKeywordsFromText(hydeText, techStackTokens);
      const merged = [...new Set([...baseKeywordSeed, ...hydeKeywords])];
      const hydeGoal = {
        ...analyzedGoal,
        originalGoal: hydeText,
        keywords: merged,
        expandedKeywords: merged
      };

      categories.forEach((cat) => {
        const categoryMinScore = categoryMinScoreMap[cat] ?? minScore;
        const list = scoreResourcesForGoal(
          resourceIndex[cat] || [],
          hydeGoal,
          techContext,
          { categoryMinScore, hasInstructionSignal }
        );
        variantListsByCategory[cat].push(list);
      });

      const recomputed = computeResults();
      computed = recomputed.computed;
      meta = recomputed.meta;
      hydeUsed = true;
    }
  }

  results.knowledge = computed.knowledge;
  results.skills = computed.skills;
  results.tools = computed.tools;

  if (includeMeta) {
    results.__meta = {
      rrfUsed: meta.rrfUsed,
      ragFusionUsed: meta.ragFusionUsed,
      ragFusionVariants: variantTexts.length + (hydeUsed ? 1 : 0),
      hydeUsed,
      hybridUsed: hybridConfig.enabled === true,
      vectorIndexUsed: vectorEnabled && vectorUsed,
      routingMode: routingOptions.routingMode,
      maxResults,
      minScore
    };
  }

  return results;
}

/**
 * Format results for flight plan output
 */
function formatForFlightPlan(results) {
  const formatted = {
    knowledge: [],
    skills: [],
    tools: []
  };

  ['knowledge', 'skills', 'tools'].forEach((cat) => {
    const resources = results[cat] || [];
    formatted[cat] = resources.map(r => ({
      file: r.filePath,
      score: Math.round(r.score * 100),
      preview: r.summary.substring(0, 100),
      techStack: r.techStack,
      domains: r.domains,
      isInstruction: r.isInstruction
    }));
  });

  return formatted;
}

module.exports = {
  findResources,
  formatForFlightPlan,
  detectFileTechStack,
  detectFileDomains,
  scoreResource
};
