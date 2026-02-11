const express = require('express')
const { validate } = require('../middleware/validate')
const { createUserSchema, updateUserSchema } = require('../validators/users')
const { audit } = require('./helpers')

function createUserRoutes({ auth, authStore }) {
  const router = express.Router()

  router.get(
    '/users',
    auth.requirePermission('users', 'read', 'admin'),
    (req, res) => {
      res.json(authStore.listUsers())
    }
  )

  router.post(
    '/users',
    auth.requirePermission('users', 'create', 'admin'),
    validate(createUserSchema),
    (req, res) => {
      const { username, password, role, workspaceId } = req.body
      const user = authStore.createUser({
        username,
        password,
        role,
        workspaceId: workspaceId || null,
      })
      if (!user) {
        return res.status(400).json({ success: false, error: 'User already exists' })
      }
      audit('users.create', { id: user.id, username: user.username, role: user.role }, req)
      res.json({ success: true, user })
    }
  )

  router.put(
    '/users/:id',
    auth.requirePermission('users', 'update', 'admin'),
    validate(updateUserSchema),
    (req, res) => {
      const { id } = req.params
      const updates = req.body

      if (updates.disabled === true) {
        const target = authStore.findById(id)
        if (target?.role === 'admin' && authStore.countAdmins() <= 1) {
          return res.status(400).json({ success: false, error: 'Cannot disable the last admin' })
        }
      }

      const updated = authStore.updateUser(id, updates)
      if (!updated) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }
      audit('users.update', { id, username: updated.username, role: updated.role }, req)
      res.json({ success: true, user: updated })
    }
  )

  router.delete(
    '/users/:id',
    auth.requirePermission('users', 'delete', 'admin'),
    (req, res) => {
      const { id } = req.params
      const target = authStore.findById(id)
      if (target?.role === 'admin' && authStore.countAdmins() <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot delete the last admin' })
      }
      const success = authStore.deleteUser(id)
      if (!success) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }
      audit('users.delete', { id }, req)
      res.json({ success: true })
    }
  )

  return router
}

module.exports = createUserRoutes
