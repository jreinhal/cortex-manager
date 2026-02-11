const express = require('express')
const { validate } = require('../middleware/validate')
const { createWorkspaceSchema, updateWorkspaceSchema } = require('../validators/workspaces')
const { audit } = require('./helpers')

function createWorkspaceRoutes({ config, auth, workspaces }) {
  const router = express.Router()

  router.get(
    '/workspaces',
    auth.requirePermission('workspaces', 'read', 'viewer'),
    (req, res) => {
      const all = workspaces.listWorkspaces()
      if (req.user?.role === 'admin') {
        return res.json(all)
      }
      const scoped = workspaces.resolveWorkspace(req)
      return res.json(scoped ? [scoped] : [])
    }
  )

  router.get(
    '/workspaces/active',
    auth.requirePermission('workspaces', 'read', 'viewer'),
    (req, res) => {
      const current = workspaces.resolveWorkspace(req)
      const list =
        req.user?.role === 'admin' ? workspaces.listWorkspaces() : current ? [current] : []
      res.json({ active: current, workspaces: list })
    }
  )

  router.post(
    '/workspaces',
    auth.requirePermission('workspaces', 'create', 'admin'),
    validate(createWorkspaceSchema),
    (req, res) => {
      const { id, name, reposRoot, outputDir, createStructure } = req.body || {}
      if (!reposRoot) {
        return res.status(400).json({ success: false, error: 'reposRoot is required' })
      }
      const workspace = workspaces.upsertWorkspace({
        id,
        name,
        reposRoot,
        outputDir,
        createStructure: createStructure === true,
      })
      audit('workspaces.create', { id: workspace.id, name: workspace.name }, req)
      res.json({ success: true, workspace })
    }
  )

  router.put(
    '/workspaces/:id',
    auth.requirePermission('workspaces', 'update', 'admin'),
    validate(updateWorkspaceSchema),
    (req, res) => {
      const { id } = req.params
      const { name, reposRoot, outputDir, createStructure } = req.body || {}
      const workspace = workspaces.upsertWorkspace({
        id,
        name,
        reposRoot,
        outputDir,
        createStructure: createStructure === true,
      })
      audit('workspaces.update', { id: workspace.id }, req)
      res.json({ success: true, workspace })
    }
  )

  router.post(
    '/workspaces/:id/default',
    auth.requirePermission('workspaces', 'update', 'admin'),
    (req, res) => {
      const { id } = req.params
      const target = workspaces.getWorkspaceById(id)
      if (!target) {
        return res.status(404).json({ success: false, error: 'Workspace not found' })
      }
      const current = config.getConfig()
      const updated = config.updateConfig({
        workspaces: {
          ...(current.workspaces || {}),
          defaultId: id,
        },
      })
      audit('workspaces.set_default', { id }, req)
      res.json({ success: true, workspace: target, config: updated })
    }
  )

  router.delete(
    '/workspaces/:id',
    auth.requirePermission('workspaces', 'delete', 'admin'),
    (req, res) => {
      const { id } = req.params
      const result = workspaces.removeWorkspace(id)
      if (!result.success) {
        return res.status(400).json(result)
      }
      audit('workspaces.delete', { id }, req)
      res.json({ success: true })
    }
  )

  return router
}

module.exports = createWorkspaceRoutes
