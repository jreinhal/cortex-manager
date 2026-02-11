const express = require('express')
const { audit } = require('./helpers')

function createScimRoutes({ config, authStore }) {
  const router = express.Router()

  function requireScimToken(req, res, next) {
    const currentConfig = config.getConfig()
    if (currentConfig.auth?.scim?.enabled !== true) {
      return res.status(404).json({ error: 'SCIM is disabled' })
    }
    const expected = currentConfig.auth?.scim?.token
    if (!expected) {
      return res.status(403).json({ error: 'SCIM token not configured' })
    }
    const header = req.headers.authorization || ''
    const provided = header.startsWith('Bearer ')
      ? header.slice(7)
      : req.headers['x-scim-token'] || null
    if (!provided || provided !== expected) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    return next()
  }

  router.get('/scim/users', requireScimToken, (req, res) => {
    res.json({ users: authStore.listUsers() })
  })

  router.post('/scim/users', requireScimToken, (req, res) => {
    const { username, role, workspaceId, active } = req.body || {}
    if (!username) {
      return res.status(400).json({ error: 'username is required' })
    }
    const created = authStore.upsertExternalUser({
      username,
      role: role || 'viewer',
      workspaceId: workspaceId || null,
      provider: 'scim',
    })
    if (!created) {
      return res.status(500).json({ error: 'Failed to create user' })
    }
    if (active === false) {
      authStore.updateUser(created.id, { disabled: true })
    }
    audit('scim.user.create', { id: created.id, username }, req)
    res.json({ success: true, user: created })
  })

  router.put('/scim/users/:id', requireScimToken, (req, res) => {
    const { id } = req.params
    const updates = req.body || {}
    const updated = authStore.updateUser(id, updates)
    if (!updated) {
      return res.status(404).json({ error: 'User not found' })
    }
    audit('scim.user.update', { id }, req)
    res.json({ success: true, user: updated })
  })

  router.patch('/scim/users/:id', requireScimToken, (req, res) => {
    const { id } = req.params
    const updates = req.body || {}
    const updated = authStore.updateUser(id, updates)
    if (!updated) {
      return res.status(404).json({ error: 'User not found' })
    }
    audit('scim.user.update', { id }, req)
    res.json({ success: true, user: updated })
  })

  router.delete('/scim/users/:id', requireScimToken, (req, res) => {
    const { id } = req.params
    const success = authStore.deleteUser(id)
    if (!success) {
      return res.status(404).json({ error: 'User not found' })
    }
    audit('scim.user.delete', { id }, req)
    res.json({ success: true })
  })

  return router
}

module.exports = createScimRoutes
