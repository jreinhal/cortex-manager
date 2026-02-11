const express = require('express')
const { validate } = require('../middleware/validate')
const { bootstrapSchema, loginSchema } = require('../validators/auth')
const { audit } = require('./helpers')

function createAuthRoutes({ config, auth, authStore }) {
  const router = express.Router()

  router.get('/auth/status', (req, res) => {
    const currentConfig = config.getConfig()
    const enabled = currentConfig.auth?.enabled === true
    const hasUsers = authStore.hasUsers()
    res.json({
      enabled,
      bootstrapAllowed: currentConfig.auth?.bootstrapAllowed !== false,
      bootstrapNeeded: enabled && !hasUsers,
      roles: ['viewer', 'editor', 'admin'],
      rbac: {
        enabled: currentConfig.auth?.rbac?.enabled !== false,
      },
      sso: {
        enabled: currentConfig.auth?.sso?.enabled === true,
        mode: currentConfig.auth?.sso?.mode || 'header',
        headerUser: currentConfig.auth?.sso?.headerUser || 'x-cortex-user',
        headerRole: currentConfig.auth?.sso?.headerRole || 'x-cortex-role',
        headerWorkspace: currentConfig.auth?.sso?.headerWorkspace || 'x-cortex-workspace',
        autoProvision: currentConfig.auth?.sso?.autoProvision !== false,
      },
      scim: {
        enabled: currentConfig.auth?.scim?.enabled === true,
      },
    })
  })

  router.post('/auth/bootstrap', validate(bootstrapSchema), (req, res) => {
    const currentConfig = config.getConfig()
    if (currentConfig.auth?.enabled !== true) {
      return res.status(400).json({ success: false, error: 'Auth is disabled' })
    }
    if (currentConfig.auth?.bootstrapAllowed === false) {
      return res.status(403).json({ success: false, error: 'Bootstrap is disabled' })
    }
    if (authStore.hasUsers()) {
      return res.status(400).json({ success: false, error: 'Users already exist' })
    }

    const { username, password, workspaceId } = req.body

    const user = authStore.createUser({
      username,
      password,
      role: 'admin',
      workspaceId: workspaceId || req.workspaceId || null,
    })
    if (!user) {
      return res.status(500).json({ success: false, error: 'Failed to create admin user' })
    }
    const token = auth.issueToken(user)
    authStore.recordLogin(user.id)
    audit('auth.bootstrap', { username: user.username }, req)
    res.json({ success: true, token, user })
  })

  router.post('/auth/login', validate(loginSchema), (req, res) => {
    const currentConfig = config.getConfig()
    if (currentConfig.auth?.enabled !== true) {
      return res.status(400).json({ success: false, error: 'Auth is disabled' })
    }
    const { username, password } = req.body
    const user = authStore.verifyLogin(username, password)
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }
    authStore.recordLogin(user.id)
    const token = auth.issueToken(user)
    audit('auth.login', { username: user.username }, req)
    res.json({ success: true, token, user })
  })

  router.get('/auth/me', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    res.json({ user: req.user })
  })

  return router
}

module.exports = createAuthRoutes
