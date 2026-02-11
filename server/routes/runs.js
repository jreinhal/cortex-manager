const express = require('express')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const { spawn } = require('child_process')
const os = require('os')
const { validate } = require('../middleware/validate')
const { spawnSchema } = require('../validators/spawn')
const { createSessionSchema } = require('../validators/sessions')
const { readJsonFileAsync, writeJsonAtomicAsync } = require('../storage')
const { audit, matchesWorkspace, resolveRunOutputPath } = require('./helpers')

function createRunRoutes({ config, auth, runsStore, jobQueue, vectorIndex }) {
  const router = express.Router()
  const { summarizeObservability } = require('../observability')

  // Orchestrator (spawn)
  router.post(
    '/spawn',
    auth.requirePermission('runs', 'create', 'editor'),
    validate(spawnSchema),
    (req, res) => {
      const { goal, format, async: asyncMode, externalSkills: externalSkillsRequest } = req.body
      const normalizedFormat = format
      const orchestratorPath = path.join(__dirname, '..', 'orchestrator.js')

      console.log(`[ORCHESTRATOR] Spawning: ${goal} (format: ${normalizedFormat})`)
      audit('spawn.start', { format: normalizedFormat, goal }, req)

      const externalSkillsEnv = {}
      if (externalSkillsRequest && typeof externalSkillsRequest === 'object') {
        if (typeof externalSkillsRequest.online === 'boolean') {
          externalSkillsEnv.CORTEX_ONLINE_SKILLS = externalSkillsRequest.online ? '1' : '0'
        }
        if (
          typeof externalSkillsRequest.trainingMode === 'string' &&
          externalSkillsRequest.trainingMode.trim()
        ) {
          externalSkillsEnv.CORTEX_ONLINE_SKILLS_TRAINING =
            externalSkillsRequest.trainingMode.trim()
        }
      }

      const queueEnabled = config.getConfig().queue?.enabled === true
      if (asyncMode === true && queueEnabled === true) {
        const job = jobQueue.enqueueJob({
          type: 'spawn',
          payload: {
            goal,
            format: normalizedFormat,
            externalSkills: externalSkillsRequest || null,
            workspaceId: req.workspace?.id || null,
            reposRoot: req.workspace?.reposRoot || null,
            outputDir: req.workspace?.outputDir || null,
          },
          createdBy: req.user?.username || null,
          workspaceId: req.workspace?.id || null,
        })
        return res.json({ success: true, queued: true, job })
      }

      const child = spawn('node', [orchestratorPath, goal, normalizedFormat], {
        cwd: path.join(__dirname, '..', '..'),
        env: {
          ...process.env,
          REPOS_ROOT: req.workspace?.reposRoot || config.getConfig().reposRoot,
          CORTEX_OUTPUT_DIR: req.workspace?.outputDir || config.getConfig().outputDir,
          CORTEX_WORKSPACE_ID: req.workspace?.id || null,
          ...externalSkillsEnv,
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log(`[ORCHESTRATOR] ${data.toString().trim()}`)
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[ORCHESTRATOR ERR] ${data.toString().trim()}`)
      })

      child.on('error', (err) => {
        console.error('[ORCHESTRATOR] Process error:', err)
        res.status(500).json({ success: false, error: err.message })
      })

      child.on('close', (code) => {
        if (code !== 0) {
          audit('spawn.failed', { format: normalizedFormat, goal, code }, req)
          return res.status(500).json({
            success: false,
            error: `Orchestrator exited with code ${code}`,
            output: stdout + stderr,
          })
        }

        audit('spawn.complete', { format: normalizedFormat, goal }, req)
        config.recordSpawn(goal, 'std-agent', 0, req.workspace?.id || null)
        res.json({ success: true, output: stdout })
      })
    }
  )

  // Analytics
  router.get(
    '/analytics',
    auth.requirePermission('analytics', 'read', 'viewer'),
    (req, res) => {
      const analytics = config.getAnalytics(req.workspace?.id || null)
      res.json(analytics)
    }
  )

  // Sessions
  const SESSIONS_FILE = path.join(__dirname, '..', '..', 'sessions.json')

  async function loadSessions() {
    const data = await readJsonFileAsync(SESSIONS_FILE, [])
    return Array.isArray(data) ? data : []
  }

  async function saveSessions(sessions) {
    await writeJsonAtomicAsync(SESSIONS_FILE, sessions)
  }

  router.get(
    '/sessions',
    auth.requirePermission('sessions', 'read', 'viewer'),
    async (req, res) => {
      const sessions = await loadSessions()
      const workspaceId = req.workspace?.id || null
      const filtered = sessions.filter((session) => matchesWorkspace(session, workspaceId))
      res.json(filtered.slice(-20).reverse())
    }
  )

  router.post(
    '/sessions',
    auth.requirePermission('sessions', 'create', 'editor'),
    validate(createSessionSchema),
    async (req, res) => {
      const { goal, agent, resources, output } = req.body

      const sessions = await loadSessions()
      const session = {
        id: `session-${Date.now()}`,
        timestamp: new Date().toISOString(),
        workspaceId: req.workspace?.id || null,
        goal,
        agent,
        resources,
        outputPreview: output ? output.substring(0, 500) : null,
      }

      sessions.push(session)

      const trimmed = sessions.slice(-50)
      await saveSessions(trimmed)
      audit('sessions.create', { id: session.id }, req)

      res.json({ success: true, session })
    }
  )

  // Runs
  router.get(
    '/runs',
    auth.requirePermission('runs', 'read', 'viewer'),
    (req, res) => {
      const workspaceId = req.workspace?.id || null
      const runs = runsStore.loadRuns().filter((run) => matchesWorkspace(run, workspaceId))
      const limit = Number(req.query.limit)
      if (!Number.isNaN(limit) && limit > 0) {
        return res.json(runs.slice(0, limit))
      }
      res.json(runs)
    }
  )

  router.get(
    '/runs/:id',
    auth.requirePermission('runs', 'read', 'viewer'),
    (req, res) => {
      const run = runsStore.getRun(req.params.id)
      if (!run) {
        return res.status(404).json({ error: 'Run not found' })
      }
      if (!matchesWorkspace(run, req.workspace?.id || null)) {
        return res.status(404).json({ error: 'Run not found' })
      }
      res.json(run)
    }
  )

  router.get(
    '/runs/:id/export',
    auth.requirePermission('runs', 'read', 'viewer'),
    async (req, res) => {
      const run = runsStore.getRun(req.params.id)
      if (!run) {
        return res.status(404).json({ error: 'Run not found' })
      }
      if (!matchesWorkspace(run, req.workspace?.id || null)) {
        return res.status(404).json({ error: 'Run not found' })
      }

      const includeOutput = req.query.includeOutput === 'true' || req.query.includeOutput === '1'
      let output = null
      if (includeOutput) {
        const resolved = resolveRunOutputPath(run, req.workspace)
        if (resolved) {
          try {
            output = await fsp.readFile(resolved, 'utf8')
          } catch (_e) {
            // file missing or unreadable
          }
        }
      }

      audit('runs.export', { id: run.id, includeOutput }, req)
      res.setHeader('Content-Disposition', `attachment; filename="cortex-run-${run.id}.json"`)
      res.json({ run, output })
    }
  )

  router.get(
    '/runs/:id/plan',
    auth.requirePermission('runs', 'read', 'viewer'),
    async (req, res) => {
      const run = runsStore.getRun(req.params.id)
      if (!run) {
        return res.status(404).json({ error: 'Run not found' })
      }
      if (!matchesWorkspace(run, req.workspace?.id || null)) {
        return res.status(404).json({ error: 'Run not found' })
      }

      const resolved = resolveRunOutputPath(run, req.workspace)
      if (!resolved) {
        return res.status(404).json({ error: 'Flight plan not found' })
      }

      try {
        const content = await fsp.readFile(resolved, 'utf8')
        audit('runs.plan.download', { id: run.id, file: path.basename(resolved) }, req)
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(resolved)}"`)
        res.send(content)
      } catch (_e) {
        return res.status(404).json({ error: 'Flight plan not found' })
      }
    }
  )

  // Observability
  router.get(
    '/observability/summary',
    auth.requirePermission('observability', 'read', 'viewer'),
    (req, res) => {
      res.json(summarizeObservability(req.workspace?.id || null))
    }
  )

  router.get(
    '/observability/metrics',
    auth.requirePermission('observability', 'read', 'viewer'),
    (req, res) => {
      const memory = process.memoryUsage()
      res.json({
        uptimeSec: Math.round(process.uptime()),
        memory: {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
        },
        cpu: {
          loadAvg: os.loadavg(),
          cores: os.cpus().length,
        },
        queue: jobQueue.getQueueStats(),
        vectorIndex: vectorIndex.getStatus({ workspaceId: req.workspace?.id || null }),
        workspace: req.workspace?.id || null,
      })
    }
  )

  return router
}

module.exports = createRunRoutes
