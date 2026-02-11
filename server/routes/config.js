const express = require('express')
const path = require('path')
const fs = require('fs')
const { validate } = require('../middleware/validate')
const { configUpdateSchema } = require('../validators/config')
const { setupSchema, validatePathSchema, llmPingSchema } = require('../validators/setup')
const { audit, isLocalEndpoint } = require('./helpers')

function createConfigRoutes({ config, auth }) {
  const router = express.Router()

  router.get(
    '/config',
    auth.requirePermission('config', 'read', 'viewer'),
    (req, res) => {
      const repoManager = require('../repo-manager')
      const currentConfig = config.getConfig()
      const safeConfig = {
        ...currentConfig,
        auth: {
          ...(currentConfig.auth || {}),
          secret: null,
          scim: {
            ...(currentConfig.auth?.scim || {}),
            token: null,
          },
        },
      }
      const systemInfo = config.getSystemInfo()
      const isFirstRun = config.isFirstRun()

      res.json({
        config: safeConfig,
        system: systemInfo,
        isFirstRun,
        gitAvailable: repoManager.isGitAvailable(),
      })
    }
  )

  router.get(
    '/checklist',
    auth.requirePermission('system', 'read', 'viewer'),
    (req, res) => {
      const checklistPath = path.resolve(__dirname, '..', '..', 'TESTING.md')
      if (!fs.existsSync(checklistPath)) {
        return res.status(404).json({ error: 'Checklist not found.' })
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', 'inline; filename="TESTING.md"')
      return res.send(fs.readFileSync(checklistPath, 'utf8'))
    }
  )

  router.post(
    '/config',
    auth.requirePermission('config', 'update', 'admin'),
    validate(configUpdateSchema),
    (req, res) => {
      const updates = req.body || {}
      if (updates.auth && Object.prototype.hasOwnProperty.call(updates.auth, 'secret')) {
        delete updates.auth.secret
      }
      if (updates.auth?.scim && Object.prototype.hasOwnProperty.call(updates.auth.scim, 'token')) {
        delete updates.auth.scim.token
      }

      let validationWarnings = []
      if (updates.reposRoot) {
        const validation = config.validateReposRoot(updates.reposRoot)
        validationWarnings = [...(validation.errors || []), ...(validation.warnings || [])]
      }

      const current = config.getConfig()
      const merged = {
        ...current,
        ...updates,
        auth: { ...(current.auth || {}), ...(updates.auth || {}) },
        llm: { ...(current.llm || {}), ...(updates.llm || {}) },
        ui: { ...(current.ui || {}), ...(updates.ui || {}) },
        queue: { ...(current.queue || {}), ...(updates.queue || {}) },
        vectorIndex: { ...(current.vectorIndex || {}), ...(updates.vectorIndex || {}) },
        observability: { ...(current.observability || {}), ...(updates.observability || {}) },
        decisionMatrix: { ...(current.decisionMatrix || {}), ...(updates.decisionMatrix || {}) },
        evaluation: { ...(current.evaluation || {}), ...(updates.evaluation || {}) },
        workspaces: updates.workspaces
          ? { ...(current.workspaces || {}), ...(updates.workspaces || {}) }
          : current.workspaces || {},
      }

      const newConfig = config.updateConfig(merged)
      if (newConfig) {
        audit('config.update', { keys: Object.keys(updates || {}) }, req)
        res.json({ success: true, config: newConfig, warnings: validationWarnings })
      } else {
        res.status(500).json({ success: false, error: 'Failed to save configuration' })
      }
    }
  )

  router.post(
    '/setup',
    auth.requirePermission('config', 'update', 'admin'),
    validate(setupSchema),
    (req, res) => {
      const { reposRoot, createStructure } = req.body

      const validation = config.validateReposRoot(reposRoot)

      let createdDirs = []
      if (createStructure) {
        try {
          createdDirs = config.createDirectoryStructure(reposRoot)
        } catch (e) {
          return res.status(500).json({
            success: false,
            error: `Failed to create directories: ${e.message}`,
          })
        }
      }

      const success = config.completeFirstRun(reposRoot)

      if (success) {
        audit('setup.complete', { reposRoot, createdDirs }, req)
        res.json({
          success: true,
          message: 'Setup complete',
          reposRoot,
          createdDirectories: createdDirs,
          warnings: [...(validation.errors || []), ...(validation.warnings || [])],
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to save configuration',
          warnings: [...(validation.errors || []), ...(validation.warnings || [])],
        })
      }
    }
  )

  router.post(
    '/validate-path',
    auth.requirePermission('system', 'read', 'viewer'),
    validate(validatePathSchema),
    (req, res) => {
      const { path: pathToValidate } = req.body
      const validation = config.validateReposRoot(pathToValidate)
      res.json(validation)
    }
  )

  router.post(
    '/llm/ping',
    auth.requirePermission('llm', 'test', 'viewer'),
    validate(llmPingSchema),
    async (req, res) => {
      const { endpoint, model, provider } = req.body || {}
      const llmConfig = config.getConfig().llm || {}
      const target = endpoint || llmConfig.endpoint
      const selectedModel = model || llmConfig.model || 'gpt-3.5-turbo'
      const selectedProvider = provider || llmConfig.provider

      if (!target) {
        return res.status(400).json({ success: false, reachable: false, error: 'Endpoint is required' })
      }
      if (llmConfig.allowRemote === false && !isLocalEndpoint(target)) {
        return res.status(403).json({
          success: false,
          reachable: false,
          error: 'Remote LLM endpoints are disabled',
        })
      }

      const isOllama = selectedProvider === 'ollama' || /\/api\/chat/i.test(target)
      const payload = isOllama
        ? {
            model: selectedModel,
            messages: [{ role: 'user', content: 'ping' }],
            stream: false,
            options: { temperature: 0, num_predict: 1 },
          }
        : {
            model: selectedModel,
            messages: [{ role: 'user', content: 'ping' }],
            temperature: 0,
            max_tokens: 1,
          }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        res.json({
          success: true,
          endpoint: target,
          reachable: true,
          ok: response.ok,
          status: response.status,
        })
      } catch (_e) {
        try {
          const response = await fetch(target, { method: 'HEAD', signal: controller.signal })
          res.json({
            success: true,
            endpoint: target,
            reachable: true,
            ok: response.ok,
            status: response.status,
            note: 'HEAD fallback',
          })
        } catch (err) {
          res.json({
            success: false,
            endpoint: target,
            reachable: false,
            error: err.message,
          })
        }
      } finally {
        clearTimeout(timeout)
      }
    }
  )

  router.get(
    '/default-paths',
    auth.requirePermission('system', 'read', 'viewer'),
    (req, res) => {
      res.json({
        reposRoot: config.getDefaultReposRoot(),
        outputDir: config.getDefaultOutputDir(),
      })
    }
  )

  router.get(
    '/browse',
    auth.requirePermission('system', 'read', 'viewer'),
    (req, res) => {
      const requestedPath = req.query.path || ''

      let targetPath

      if (!requestedPath) {
        if (process.platform === 'win32') {
          const drives = []
          for (const letter of ['C', 'D', 'E', 'F']) {
            const drivePath = `${letter}:\\`
            try {
              fs.accessSync(drivePath, fs.constants.R_OK)
              drives.push({ name: `${letter}:`, path: drivePath, isDirectory: true })
            } catch (_e) {
              // Drive doesn't exist or not accessible
            }
          }
          return res.json({
            path: '',
            parent: null,
            items: drives,
          })
        } else {
          targetPath = '/'
        }
      } else {
        targetPath = requestedPath
      }

      targetPath = path.normalize(targetPath)

      try {
        fs.accessSync(targetPath, fs.constants.R_OK)
      } catch (_e) {
        return res.status(400).json({
          success: false,
          error: 'Path does not exist or is not accessible',
        })
      }

      const stat = fs.statSync(targetPath)
      if (!stat.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'Path is not a directory',
        })
      }

      try {
        const entries = fs.readdirSync(targetPath, { withFileTypes: true })
        const items = entries
          .filter((entry) => {
            if (!entry.isDirectory()) return false
            if (entry.name.startsWith('.') && process.platform !== 'win32') return false
            if (['$RECYCLE.BIN', 'System Volume Information', 'node_modules'].includes(entry.name))
              return false
            return true
          })
          .map((entry) => ({
            name: entry.name,
            path: path.join(targetPath, entry.name),
            isDirectory: true,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))

        const parentPath = path.dirname(targetPath)
        const hasParent = parentPath !== targetPath

        res.json({
          path: targetPath,
          parent: hasParent ? parentPath : null,
          items,
        })
      } catch (e) {
        res.status(500).json({
          success: false,
          error: `Failed to read directory: ${e.message}`,
        })
      }
    }
  )

  return router
}

module.exports = createConfigRoutes
