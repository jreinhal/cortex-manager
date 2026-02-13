const express = require('express')
const path = require('path')
const fsp = require('fs').promises
const { validate } = require('../middleware/validate')
const { createPromptSchema, updatePromptSchema } = require('../validators/prompts')
const { audit } = require('./helpers')

function createPromptRoutes({ config, auth }) {
  const router = express.Router()

  router.get(
    '/prompts',
    auth.requirePermission('prompts', 'read', 'viewer'),
    (req, res) => {
      const prompts = config.getSavedPrompts(req.workspace?.id || null)
      res.json(prompts)
    }
  )

  router.post(
    '/prompts',
    auth.requirePermission('prompts', 'create', 'editor'),
    validate(createPromptSchema),
    (req, res) => {
      const { title, query } = req.body
      const prompt = config.savePrompt(title, query, req.workspace?.id || null)
      audit('prompts.save', { id: prompt.id, title: prompt.title }, req)
      res.json({ success: true, prompt })
    }
  )

  router.put(
    '/prompts/:id',
    auth.requirePermission('prompts', 'update', 'editor'),
    validate(updatePromptSchema),
    (req, res) => {
      const { id } = req.params
      const { title, query } = req.body

      const existing = config.getSavedPrompts(req.workspace?.id || null).find((p) => p.id === id)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Prompt not found' })
      }
      const prompt = config.updatePrompt(id, { title, query })

      if (prompt) {
        audit('prompts.update', { id: prompt.id, title: prompt.title }, req)
        res.json({ success: true, prompt })
      } else {
        res.status(404).json({ success: false, error: 'Prompt not found' })
      }
    }
  )

  router.delete(
    '/prompts/all',
    auth.requirePermission('prompts', 'delete', 'editor'),
    (req, res) => {
      const workspaceId = req.workspace?.id || null
      const deletedCount = config.deleteAllPrompts(workspaceId)
      audit('prompts.clear-all', { deletedCount }, req)
      res.json({ success: true, deletedCount })
    }
  )

  router.delete(
    '/prompts/:id',
    auth.requirePermission('prompts', 'delete', 'editor'),
    (req, res) => {
      const { id } = req.params

      const existing = config.getSavedPrompts(req.workspace?.id || null).find((p) => p.id === id)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Prompt not found' })
      }
      const success = config.deletePrompt(id)

      if (success) {
        audit('prompts.delete', { id }, req)
        res.json({ success: true })
      } else {
        res.status(404).json({ success: false, error: 'Prompt not found' })
      }
    }
  )

  // Agents registry
  router.get(
    '/agents',
    auth.requirePermission('agents', 'read', 'viewer'),
    async (req, res) => {
      const currentConfig = config.getConfig()
      const agentsDir = path.join(req.workspace?.reposRoot || currentConfig.reposRoot, 'agents')

      let entries
      try {
        entries = await fsp.readdir(agentsDir, { withFileTypes: true })
      } catch (_e) {
        return res.json([])
      }

      const agents = []

      for (const dir of entries.filter((d) => d.isDirectory() && !d.name.startsWith('.'))) {
        const agentPath = path.join(agentsDir, dir.name)
        let hasTemplate = false
        try {
          await fsp.access(path.join(agentPath, 'template.md'))
          hasTemplate = true
        } catch (_e) {
          // no template.md
        }
        const templatePath = hasTemplate
          ? path.join(agentPath, 'template.md')
          : path.join(agentPath, 'README.md')
        let description = ''
        let name = dir.name
        let keywords = []

        const configPath = path.join(agentPath, 'agent.config.json')
        try {
          const raw = await fsp.readFile(configPath, 'utf8')
          const data = JSON.parse(raw)
          name = data.name || name
          description = data.description || description
          keywords = Array.isArray(data.keywords) ? data.keywords : keywords
        } catch (_e) {
          // skip — no config or parse error
        }

        if (!description) {
          try {
            const content = await fsp.readFile(templatePath, 'utf8')
            const firstLine = content.split('\n').find((line) => line.trim() && !line.startsWith('#'))
            if (firstLine) description = firstLine.trim().substring(0, 140)
          } catch (_e) {
            // skip
          }
        }

        let templateExists = false
        try {
          await fsp.access(templatePath)
          templateExists = true
        } catch (_e) {
          // no template file
        }

        agents.push({
          id: dir.name,
          name,
          description: description || 'No description provided.',
          keywords,
          path: agentPath,
          templatePath: templateExists ? templatePath : null,
        })
      }

      res.json(agents)
    }
  )

  // Tools registry
  router.get(
    '/tools',
    auth.requirePermission('tools', 'read', 'viewer'),
    async (req, res) => {
      const currentConfig = config.getConfig()
      const toolsDir = path.join(req.workspace?.reposRoot || currentConfig.reposRoot, 'tools')

      let entries
      try {
        entries = await fsp.readdir(toolsDir, { withFileTypes: true })
      } catch (_e) {
        return res.json([])
      }

      const tools = []

      for (const dir of entries.filter((d) => d.isDirectory() && !d.name.startsWith('.'))) {
        const toolPath = path.join(toolsDir, dir.name)
        let metadata = { name: dir.name, description: '' }

        const pkgPath = path.join(toolPath, 'package.json')
        try {
          const raw = await fsp.readFile(pkgPath, 'utf8')
          const pkg = JSON.parse(raw)
          metadata = {
            name: pkg.name || dir.name,
            description: pkg.description || '',
            version: pkg.version,
            type: 'npm',
          }
        } catch (_e) {
          // skip — no package.json or parse error
        }

        if (!metadata.description) {
          const readmePath = path.join(toolPath, 'README.md')
          try {
            const readme = await fsp.readFile(readmePath, 'utf8')
            const firstLine = readme.split('\n').find((l) => l.trim() && !l.startsWith('#'))
            if (firstLine) metadata.description = firstLine.substring(0, 100)
          } catch (_e) {
            // skip
          }
        }

        tools.push({
          id: dir.name,
          path: toolPath,
          ...metadata,
          description: metadata.description || 'No description',
        })
      }

      res.json(tools)
    }
  )

  return router
}

module.exports = createPromptRoutes
