const express = require('express')
const { audit, readAuditEntries, formatAuditCsv } = require('./helpers')
const logStore = require('../log-store')

function createAnalyticsRoutes({ auth }) {
  const router = express.Router()

  // Audit log
  router.get(
    '/audit',
    auth.requirePermission('audit', 'read', 'viewer'),
    async (req, res) => {
      const limit = Number(req.query.limit) || 200
      const event = req.query.event || null
      const entries = await readAuditEntries({
        limit,
        workspaceId: req.workspace?.id || null,
        event,
      })
      res.json(entries)
    }
  )

  router.get(
    '/audit/export',
    auth.requirePermission('audit', 'export', 'viewer'),
    async (req, res) => {
      const format = (req.query.format || 'json').toString().toLowerCase()
      const limit = Math.min(Number(req.query.limit) || 1000, 5000)
      const event = req.query.event || null
      const entries = await readAuditEntries({
        limit,
        workspaceId: req.workspace?.id || null,
        event,
      })

      audit('audit.export', { format, count: entries.length }, req)

      const stamp = new Date().toISOString().slice(0, 10)
      if (format === 'csv') {
        const csv = formatAuditCsv(entries)
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="cortex-audit-${stamp}.csv"`)
        return res.send(csv)
      }

      res.setHeader('Content-Disposition', `attachment; filename="cortex-audit-${stamp}.json"`)
      return res.json({ entries })
    }
  )

  // Logs
  router.get(
    '/logs',
    auth.requirePermission('logs', 'read', 'viewer'),
    (req, res) => {
      const limit = Number(req.query.limit) || 100
      res.json(logStore.getLogs(limit))
    }
  )

  return router
}

module.exports = createAnalyticsRoutes
