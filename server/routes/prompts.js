const express = require('express')
const path = require('path')
const fs = require('fs')
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
    (req, res) => {
      const currentConfig = config.getConfig()
      const agentsDir = path.join(req.workspace?.reposRoot || currentConfig.reposRoot, 'agents')

      if (!fs.existsSync(agentsDir)) {
        return res.json([])
      }

      const agents = []

      fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter((dir) => dir.isDirectory() && !dir.name.startsWith('.'))
        .forEach((dir) => {
          const agentPath = path.join(agentsDir, dir.name)
          const templatePath = fs.existsSync(path.join(agentPath, 'template.md'))
            ? path.join(agentPath, 'template.md')
            : path.join(agentPath, 'README.md')
          let description = ''
          let name = dir.name
          let keywords = []

          const configPath = path.join(agentPath, 'agent.config.json')
          if (fs.existsSync(configPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
              name = data.name || name
              description = data.description || description
              keywords = Array.isArray(data.keywords) ? data.keywords : keywords
            } catch (_e) {
              // skip
            }
          }

          if (fs.existsSync(templatePath) && !description) {
            try {
              const content = fs.readFileSync(templatePath, 'utf8')
              const firstLine = content.split('\n').find((line) => line.trim() && !line.startsWith('#'))
              if (firstLine) description = firstLine.trim().substring(0, 140)
            } catch (_e) {
              // skip
            }
          }

          agents.push({
            id: dir.name,
            name,
            description: description || 'No description provided.',
            keywords,
            path: agentPath,
            templatePath: fs.existsSync(templatePath) ? templatePath : null,
          })
        })

      res.json(agents)
    }
  )

  // Tools registry
  router.get(
    '/tools',
    auth.requirePermission('tools', 'read', 'viewer'),
    (req, res) => {
      const currentConfig = config.getConfig()
      const toolsDir = path.join(req.workspace?.reposRoot || currentConfig.reposRoot, 'tools')

      if (!fs.existsSync(toolsDir)) {
        return res.json([])
      }

      const tools = []

      fs.readdirSync(toolsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .forEach((dir) => {
          const toolPath = path.join(toolsDir, dir.name)
          let metadata = { name: dir.name, description: 'No description' }

          const pkgPath = path.join(toolPath, 'package.json')
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
              metadata = {
                name: pkg.name || dir.name,
                description: pkg.description || 'No description',
                version: pkg.version,
                type: 'npm',
              }
            } catch (_e) {
              // skip
            }
          }

          const readmePath = path.join(toolPath, 'README.md')
          if (fs.existsSync(readmePath) && !metadata.description) {
            try {
              const readme = fs.readFileSync(readmePath, 'utf8')
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
          })
        })

      res.json(tools)
    }
  )

  return router
}

module.exports = createPromptRoutes
