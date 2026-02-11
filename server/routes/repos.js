const express = require('express')
const path = require('path')
const fs = require('fs')
const { validate } = require('../middleware/validate')
const { addRepoSchema } = require('../validators/repos')
const { audit, normalizeRepoPath } = require('./helpers')

function createRepoRoutes({ config, auth, repoManager, externalSkills, vectorIndex, jobQueue, workspaces }) {
  const router = express.Router()

  router.get(
    '/status',
    auth.requirePermission('system', 'read', 'viewer'),
    (req, res) => {
      const currentConfig = config.getConfig()
      const workspace = workspaces.resolveWorkspace(req)
      res.json({
        status: 'Online',
        reposRoot: workspace?.reposRoot || currentConfig.reposRoot,
        workspaceId: workspace?.id || null,
        isFirstRun: config.isFirstRun(),
        gitAvailable: repoManager.isGitAvailable(),
      })
    }
  )

  router.get(
    '/repos',
    auth.requirePermission('repos', 'read', 'viewer'),
    (req, res) => {
      try {
        const reposRoot = req.workspace?.reposRoot
        const repos = repoManager.loadRegistry(reposRoot)
        const existingPaths = new Set(repos.map((repo) => normalizeRepoPath(repo.Path)))
        const externalInstalled = externalSkills.listInstalledExternalSkills(reposRoot)
        const externalRepos = (externalInstalled || [])
          .map((item) => ({
            Name: item.slug || path.basename(item.dir || ''),
            Path: item.dir,
            Branch: item.version || 'external',
            Enabled: true,
            Category: 'skills',
            LastScanned: item.installedAt || new Date().toISOString(),
            External: true,
            ProviderId: item.providerId || null,
            ProviderType: item.providerType || null,
            Version: item.version || null,
          }))
          .filter((entry) => entry.Path && !existingPaths.has(normalizeRepoPath(entry.Path)))
        res.json([...repos, ...externalRepos])
      } catch (e) {
        console.error('Repo read error:', e)
        res.status(500).json({ error: 'Failed to read registry' })
      }
    }
  )

  router.get(
    '/categories',
    auth.requirePermission('repos', 'read', 'viewer'),
    (req, res) => {
      try {
        const categories = repoManager.getCategories(req.workspace?.reposRoot)
        res.json(categories)
      } catch (e) {
        console.error('Categories read error:', e)
        res.status(500).json({ error: 'Failed to list categories' })
      }
    }
  )

  router.get(
    '/category-sizes',
    auth.requirePermission('repos', 'read', 'viewer'),
    async (req, res) => {
      try {
        const sizes = await repoManager.getCategorySizesAsync(req.workspace?.reposRoot)
        res.json(sizes)
      } catch (e) {
        console.error('Category size error:', e)
        res.status(500).json({ error: 'Failed to compute category sizes' })
      }
    }
  )

  router.post(
    '/scan',
    auth.requirePermission('repos', 'scan', 'editor'),
    (req, res) => {
      try {
        const results = repoManager.scanRepositories(req.workspace?.reposRoot, (msg) => {
          console.log(`[SCAN] ${msg}`)
        })

        audit('repos.scan', { found: results.found?.length || 0, newRepos: results.newRepos }, req)
        res.json({
          success: true,
          output: `Found ${results.found.length} repositories (${results.newRepos} new)`,
          results,
        })
      } catch (e) {
        console.error('[SCAN ERROR]', e)
        res.status(500).json({ success: false, error: e.message })
      }
    }
  )

  router.post(
    '/add',
    auth.requirePermission('repos', 'create', 'editor'),
    validate(addRepoSchema),
    async (req, res) => {
      const { url } = req.body
      const trimmedUrl = url.trim()
      const isValidUrl =
        /^https?:\/\//i.test(trimmedUrl) ||
        /^ssh:\/\//i.test(trimmedUrl) ||
        /^git@[^:]+:.+/i.test(trimmedUrl) ||
        /^file:\/\//i.test(trimmedUrl) ||
        fs.existsSync(trimmedUrl) ||
        path.isAbsolute(trimmedUrl)
      if (!isValidUrl) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_URL',
          error: 'Invalid repository URL. Use https://, ssh://, git@host:path, file://, or a local path.',
        })
      }

      try {
        const result = await repoManager.cloneRepository(
          trimmedUrl,
          (msg) => {
            console.log(`[CLONE] ${msg}`)
          },
          { reposRoot: req.workspace?.reposRoot }
        )

        if (result.success) {
          audit(
            'repos.clone',
            { name: result.repo?.name, category: result.repo?.category, source: trimmedUrl },
            req
          )
          res.json({
            success: true,
            output: `Cloned ${result.repo.name} to ${result.repo.category}`,
            repo: result.repo,
          })
        } else {
          audit(
            'repos.clone_failed',
            { code: result.code, error: result.error, source: trimmedUrl },
            req
          )
          res.status(400).json({
            success: false,
            code: result.code,
            error: result.error,
            repo: result.repo,
          })
        }
      } catch (e) {
        console.error('[CLONE ERROR]', e)
        res.status(500).json({ success: false, error: e.message })
      }
    }
  )

  router.delete(
    '/repos/:name',
    auth.requirePermission('repos', 'delete', 'admin'),
    (req, res) => {
      const { name } = req.params
      const { deleteFiles } = req.query

      const result = repoManager.removeRepository(name, deleteFiles === 'true', req.workspace?.reposRoot)

      if (result.success) {
        audit('repos.remove', { name, deleteFiles: deleteFiles === 'true' }, req)
        res.json(result)
      } else {
        audit('repos.remove_failed', { name, error: result.error }, req)
        res.status(400).json(result)
      }
    }
  )

  router.post(
    '/repos/:name/update',
    auth.requirePermission('repos', 'update', 'editor'),
    (req, res) => {
      const { name } = req.params
      const result = repoManager.updateRepository(name, req.workspace?.reposRoot)

      if (result.success) {
        audit('repos.update', { name }, req)
        res.json(result)
      } else {
        audit('repos.update_failed', { name, error: result.error }, req)
        res.status(400).json(result)
      }
    }
  )

  router.get(
    '/vector-index/status',
    auth.requirePermission('vector_index', 'read', 'viewer'),
    (req, res) => {
      res.json(vectorIndex.getStatus({ workspaceId: req.workspace?.id || null }))
    }
  )

  router.post(
    '/vector-index/rebuild',
    auth.requirePermission('vector_index', 'rebuild', 'editor'),
    async (req, res) => {
      const queueEnabled = config.getConfig().queue?.enabled === true
      if (queueEnabled) {
        const job = jobQueue.enqueueJob({
          type: 'vector-index',
          payload: {
            workspaceId: req.workspace?.id || null,
            reposRoot: req.workspace?.reposRoot || null,
          },
          createdBy: req.user?.username || null,
          workspaceId: req.workspace?.id || null,
        })
        audit('vectorIndex.rebuild.queued', { jobId: job.id }, req)
        return res.json({ success: true, queued: true, job })
      }
      const summary = await vectorIndex.rebuildIndex({
        workspaceId: req.workspace?.id || null,
        reposRoot: req.workspace?.reposRoot || null,
      })
      audit('vectorIndex.rebuild', { docCount: summary?.docCount }, req)
      res.json({ success: true, summary })
    }
  )

  router.get(
    '/external-skills/installed',
    auth.requirePermission('config', 'read', 'viewer'),
    (req, res) => {
      try {
        const reposRoot = req.workspace?.reposRoot || config.getConfig().reposRoot
        const installed = externalSkills.listInstalledExternalSkills(reposRoot)
        res.json({ success: true, reposRoot, installed })
      } catch (e) {
        res.status(500).json({ success: false, error: e.message })
      }
    }
  )

  router.post(
    '/external-skills/scan-updates',
    auth.requirePermission('config', 'update', 'admin'),
    async (req, res) => {
      try {
        const reposRoot = req.workspace?.reposRoot || config.getConfig().reposRoot
        const result = await externalSkills.scanForUpdates({ reposRoot, config: config.getConfig() })
        audit('externalSkills.scan_updates', { updates: result?.updates?.length || 0 }, req)
        res.json({ success: true, reposRoot, ...result })
      } catch (e) {
        res.status(500).json({ success: false, error: e.message })
      }
    }
  )

  return router
}

module.exports = createRepoRoutes
