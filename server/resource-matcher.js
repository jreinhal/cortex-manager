/**
 * Resource Matcher - Smart resource finding with tech stack filtering
 * and multi-signal relevance scoring
 */

const fs = require('fs');
const path = require('path');

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
    'prompt|agent|llm|completion': ['ai', 'llm']
  }
};

// Stop words to filter from keywords
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'function', 'const', 'let', 'var', 'return', 'import', 'export',
  'true', 'false', 'null', 'undefined', 'class', 'new', 'self'
]);

/**
 * Walk directory recursively
 */
function walkDirectory(dir, fileList = []) {
  const IGNORE = ['.git', 'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv', 'coverage', '_system'];
  const ALLOWED_EXTENSIONS = ['.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go', '.yaml', '.yml', '.json', '.sh'];

  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (IGNORE.includes(file) || file.startsWith('.')) return;

    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDirectory(filePath, fileList);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
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
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));

  const contentWords = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

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
    filenameMatch: 0.25,
    keywordMatch: 0.20,
    techStackBonus: 0.20,
    domainBonus: 0.15,
    contentMatch: 0.10,
    quality: 0.10
  };

  const keywords = analyzedGoal.keywords || [];
  const targetTech = techContext.techStack || [];
  const targetDomains = techContext.domains || [];

  // Filename match - with word boundary checking
  let filenameScore = 0;
  const fileNameLower = resource.fileName.toLowerCase();
  const fileNameTokens = fileNameLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/);

  keywords.forEach(kw => {
    const kwLower = kw.toLowerCase();
    // Exact token match (higher score)
    if (fileNameTokens.includes(kwLower)) {
      filenameScore += 2;
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

  // Calculate total
  const total =
    filenameScore * weights.filenameMatch +
    keywordScore * weights.keywordMatch +
    techScore * weights.techStackBonus +
    domainScore * weights.domainBonus +
    contentScore * weights.contentMatch +
    qualityScore * weights.quality;

  return {
    score: Math.min(1, total),
    breakdown: {
      filename: filenameScore,
      keywords: keywordScore,
      techStack: techScore,
      domains: domainScore,
      content: contentScore,
      quality: qualityScore
    }
  };
}

/**
 * Main entry point - find relevant resources
 */
function findResources(analyzedGoal, reposRoot, options = {}) {
  const {
    maxResults = 10,
    minScore = 0.15,
    category = null // null means all categories
  } = options;

  const categories = category ? [category] : ['knowledge', 'skills', 'tools'];
  const techContext = {
    techStack: [
      ...(analyzedGoal.techStack?.languages || []),
      ...(analyzedGoal.techStack?.frameworks || []),
      ...(analyzedGoal.techStack?.inferred || [])
    ],
    domains: analyzedGoal.techStack?.platforms || []
  };

  const results = {
    knowledge: [],
    skills: [],
    tools: []
  };

  for (const cat of categories) {
    const catDir = path.join(reposRoot, cat);
    if (!fs.existsSync(catDir)) continue;

    const files = walkDirectory(catDir);

    const scoredFiles = files.map(filePath => {
      // Read first 10KB of content for analysis
      let content = '';
      try {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length < 50000) {
          content = buffer.toString('utf8').substring(0, 10000);
        }
      } catch (e) {
        // Skip unreadable files
      }

      const stat = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const relativePath = path.relative(reposRoot, filePath);

      const resource = {
        filePath,
        relativePath,
        fileName,
        category: cat,
        techStack: detectFileTechStack(filePath, content),
        domains: detectFileDomains(filePath, content),
        keywords: extractKeywords(content, fileName),
        summary: extractSummary(content),
        fileSize: stat.size
      };

      // Check tech compatibility
      if (!isTechCompatible(resource.techStack, techContext.techStack)) {
        return null;
      }

      const scoring = scoreResource(resource, analyzedGoal, techContext);

      return {
        ...resource,
        score: scoring.score,
        breakdown: scoring.breakdown
      };
    }).filter(r => r !== null && r.score >= minScore);

    // Sort by score and limit
    scoredFiles.sort((a, b) => b.score - a.score);
    results[cat] = scoredFiles.slice(0, maxResults);
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

  for (const [cat, resources] of Object.entries(results)) {
    formatted[cat] = resources.map(r => ({
      file: r.filePath,
      score: Math.round(r.score * 100),
      preview: r.summary.substring(0, 100),
      techStack: r.techStack,
      domains: r.domains
    }));
  }

  return formatted;
}

module.exports = {
  findResources,
  formatForFlightPlan,
  detectFileTechStack,
  detectFileDomains,
  scoreResource
};
