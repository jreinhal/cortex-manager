const path = require('path')
const fs = require('fs')
const { recordAudit, AUDIT_PATH } = require('../audit-log')
const workspacesModule = require('../workspaces')

function audit(event, metadata, req) {
  recordAudit(event, metadata, req)
}

function matchesWorkspace(record, workspaceId) {
  if (!workspaceId) return true
  if (!record?.workspaceId) return workspacesModule.isDefaultWorkspace(workspaceId)
  return record.workspaceId === workspaceId
}

function isPathWithin(root, target) {
  if (!root || !target) return false
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  if (process.platform === 'win32') {
    const rootLower = resolvedRoot.toLowerCase()
    const targetLower = resolvedTarget.toLowerCase()
    return targetLower === rootLower || targetLower.startsWith(`${rootLower}${path.sep}`)
  }
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
}

function resolveRunOutputPath(run, workspace) {
  const config = require('../config')
  if (!run?.outputPath) return null
  const currentConfig = config.getConfig()
  const outputRoot = workspace?.outputDir || currentConfig.outputDir
  if (!outputRoot) return null
  if (!isPathWithin(outputRoot, run.outputPath)) return null
  return path.resolve(run.outputPath)
}

function normalizeRepoPath(value) {
  if (!value) return ''
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isLocalEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return true
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]'
  } catch {
    return true
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function formatAuditCsv(entries) {
  const header = [
    'timestamp',
    'event',
    'username',
    'role',
    'workspace',
    'ip',
    'userAgent',
    'metadata',
  ]
  const rows = entries.map((entry) => [
    entry.ts || '',
    entry.event || '',
    entry.user?.username || '',
    entry.user?.role || '',
    entry.workspaceId || '',
    entry.ip || '',
    entry.userAgent || '',
    JSON.stringify(entry.metadata || {}),
  ])

  return [header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join(
    '\n'
  )
}

function readAuditEntries({ limit = 200, workspaceId = null, event = null }) {
  if (!fs.existsSync(AUDIT_PATH)) return []
  try {
    const lines = fs
      .readFileSync(AUDIT_PATH, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const entries = []
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        const parsed = JSON.parse(lines[i])
        if (workspaceId && !matchesWorkspace(parsed, workspaceId)) {
          continue
        }
        if (event && parsed.event !== event) {
          continue
        }
        entries.push(parsed)
        if (entries.length >= limit) break
      } catch {
        // skip invalid line
      }
    }
    return entries
  } catch (e) {
    console.error('Failed to read audit log:', e.message)
    return []
  }
}

function normalizePathValue(value) {
  return (value || '').toString().replace(/\\/g, '/').toLowerCase()
}

function parseExpectedPaths(item) {
  if (Array.isArray(item.expectedPaths) && item.expectedPaths.length > 0) {
    return item.expectedPaths.map(normalizePathValue).filter(Boolean)
  }
  if (typeof item.expected === 'string' && item.expected.trim()) {
    return item.expected
      .split(',')
      .map((part) => normalizePathValue(part.trim()))
      .filter(Boolean)
  }
  return []
}

function readRunOutput(run, maxChars) {
  if (run?.outputPath && fs.existsSync(run.outputPath)) {
    try {
      const data = fs.readFileSync(run.outputPath, 'utf8')
      return data.length > maxChars ? data.slice(0, maxChars) : data
    } catch (_e) {
      // fall through to preview
    }
  }
  return run?.outputPreview || ''
}

function computeEvaluationMetrics(run, dataset) {
  const itemCount = Array.isArray(dataset?.items) ? dataset.items.length : 0
  const qualityScore = run?.metrics?.qualityScore ?? 0
  const baseRate = qualityScore / 100
  const normalized = itemCount > 0 ? clamp(baseRate * 0.9 + 0.1, 0, 1) : clamp(baseRate, 0, 1)
  return {
    itemCount,
    qualityScore,
    passRate: normalized,
    score: Math.round(normalized * 100),
  }
}

function tokenize(text) {
  return (text || '').toLowerCase().split(/\W+/).filter(Boolean)
}

function computeTokenOverlap(expected, actual) {
  const expectedTokens = tokenize(expected)
  const actualTokens = new Set(tokenize(actual))
  if (expectedTokens.length === 0) return 0
  let matches = 0
  for (const token of expectedTokens) {
    if (actualTokens.has(token)) matches += 1
  }
  return matches / expectedTokens.length
}

function matchExpected(output, item) {
  const expected = item.expected || ''
  const expectedType = item.expectedType || ''
  if (!expected) return { matched: false, method: 'none' }

  const expectedText = expected.trim()
  const isRegex = expectedType === 'regex' || expectedText.toLowerCase().startsWith('regex:')
  if (isRegex) {
    const pattern = expectedText.toLowerCase().startsWith('regex:')
      ? expectedText.slice('regex:'.length).trim()
      : expectedText
    try {
      const regex = new RegExp(pattern, 'i')
      return { matched: regex.test(output), method: 'regex' }
    } catch (_e) {
      return { matched: false, method: 'regex-invalid' }
    }
  }

  const normalizedOutput = normalizeText(output)
  const normalizedExpected = normalizeText(expectedText)
  return { matched: normalizedOutput.includes(normalizedExpected), method: 'contains' }
}

function scoreDatasetItem(run, item, output) {
  const weight = Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1
  if (!item.expected) {
    const overlap = computeTokenOverlap(run.goal, item.input)
    const heuristic = Math.min(1, Math.max(0, overlap * 0.8))
    return {
      id: item.id,
      input: item.input,
      expected: item.expected,
      expectedType: item.expectedType || null,
      weight,
      score: heuristic,
      status: 'needs-review',
      method: 'heuristic',
      notes: 'No expected string provided; scored via token overlap.',
    }
  }

  const match = matchExpected(output, item)
  return {
    id: item.id,
    input: item.input,
    expected: item.expected,
    expectedType: item.expectedType || null,
    rubric: item.rubric || null,
    weight,
    score: match.matched ? 1 : 0,
    status: match.matched ? 'pass' : 'fail',
    method: match.method,
    notes: match.method === 'regex-invalid' ? 'Invalid regex pattern.' : null,
  }
}

function summarizeEvaluation(items, opts = {}) {
  const passThreshold = opts.passThreshold ?? 0.75
  const warnThreshold = opts.warnThreshold ?? 0.6
  const scored = items.filter((i) => i.status !== 'needs-review')
  const needsReview = items.length - scored.length
  if (scored.length === 0) {
    return { passRate: 0, score: 0, status: 'needs-review', scoredCount: 0, needsReviewCount: needsReview }
  }
  let totalWeight = 0
  let totalWeightedScore = 0
  for (const item of scored) {
    const w = item.weight ?? 1
    totalWeight += w
    totalWeightedScore += item.score * w
  }
  const passRate = totalWeight > 0 ? totalWeightedScore / totalWeight : 0
  const score = Math.round(passRate * 100)
  let status
  if (passRate >= passThreshold) status = 'pass'
  else if (passRate >= warnThreshold) status = 'warn'
  else status = 'fail'
  return { passRate, score, status, scoredCount: scored.length, needsReviewCount: needsReview }
}

module.exports = {
  audit,
  matchesWorkspace,
  isPathWithin,
  resolveRunOutputPath,
  normalizeRepoPath,
  isLocalEndpoint,
  clamp,
  normalizeText,
  csvEscape,
  formatAuditCsv,
  readAuditEntries,
  normalizePathValue,
  parseExpectedPaths,
  readRunOutput,
  computeEvaluationMetrics,
  tokenize,
  computeTokenOverlap,
  matchExpected,
  scoreDatasetItem,
  summarizeEvaluation,
}
