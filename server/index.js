const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')

const config = require('./config')
const auth = require('./auth')
const authStore = require('./auth-store')
const workspaces = require('./workspaces')
const repoManager = require('./repo-manager')
const externalSkills = require('./external-skills')
const vectorIndex = require('./vector-index')
const jobQueue = require('./job-queue')
const logStore = require('./log-store')
const runsStore = require('./runs-store')
const datasetsStore = require('./datasets-store')
const evaluationsStore = require('./evaluations-store')
const evaluationTemplatesStore = require('./evaluation-templates-store')
const mountRoutes = require('./routes')
const { apiLimiter } = require('./middleware/rate-limit')

const app = express()
const PORT = process.env.PORT || 3001

// ==========================================
// Middleware
// ==========================================

app.use(cors())
app.use(bodyParser.json({ limit: '2mb' }))
app.use('/api', apiLimiter)

// ==========================================
// Static / Manual docs
// ==========================================

const manualDir = path.resolve(__dirname, '..', 'docs', 'user-manual')
const manualMarkdownPath = path.resolve(__dirname, '..', 'USER_MANUAL.md')

if (fs.existsSync(manualDir)) {
  app.use('/manual', express.static(manualDir))
} else if (fs.existsSync(manualMarkdownPath)) {
  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const renderManual = () => {
    const markdown = fs.readFileSync(manualMarkdownPath, 'utf8')
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CORTEX User Manual</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #e2e8f0; background: #0f172a; }
    pre { white-space: pre-wrap; line-height: 1.6; font-size: 14px; }
    h1 { font-size: 20px; }
  </style>
</head>
<body>
  <h1>CORTEX User Manual</h1>
  <pre>${escapeHtml(markdown)}</pre>
</body>
</html>`
  }

  app.get('/manual', (req, res) => res.redirect('/manual/index.html'))
  app.get('/manual/index.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(renderManual())
  })
}

// ==========================================
// Auth + Workspace resolution
// ==========================================

app.use(auth.middleware)
app.use((req, res, next) => {
  req.workspace = workspaces.resolveWorkspace(req)
  req.workspaceId = req.workspace?.id || workspaces.getDefaultWorkspace().id
  next()
})

// ==========================================
// API Routes
// ==========================================

mountRoutes(app, {
  config,
  auth,
  authStore,
  workspaces,
  repoManager,
  externalSkills,
  vectorIndex,
  jobQueue,
  runsStore,
  datasetsStore,
  evaluationsStore,
  evaluationTemplatesStore,
})

// ==========================================
// Startup
// ==========================================

function logEvent(message, level = 'info') {
  logStore.addLog(message, level)
  const prefix = level.toUpperCase()
  console.log(`[${prefix}] ${message}`)
}

const appConfig = config.getConfig()

console.log('\n========================================')
console.log('  CORTEX Backend Starting...')
console.log('========================================')
console.log(`  Platform: ${process.platform}`)
console.log(`  Node: ${process.version}`)
console.log(`  Config: ${config.CONFIG_PATH}`)
console.log(`  Repos Root: ${appConfig.reposRoot}`)
console.log(`  First Run: ${config.isFirstRun()}`)
console.log('========================================\n')
logEvent('CORTEX backend started')

// Export app for integration testing (supertest)
module.exports = app

// Only start the server when run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  CORTEX Backend running on http://localhost:${PORT}`)
    console.log(`  API endpoints available at http://localhost:${PORT}/api\n`)

    if (config.isFirstRun()) {
      console.log('  First run detected - setup wizard will appear in UI\n')
    }
  })

  jobQueue.processQueue()
  jobQueue.ensureWorkerPool()
}
