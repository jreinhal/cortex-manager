const express = require('express')
const { validate } = require('../middleware/validate')
const { createJobSchema } = require('../validators/jobs')
const { audit, matchesWorkspace } = require('./helpers')

function createJobRoutes({ auth, jobQueue }) {
  const router = express.Router()

  router.get(
    '/jobs',
    auth.requirePermission('jobs', 'read', 'viewer'),
    (req, res) => {
      const workspaceId = req.workspace?.id || null
      const jobs = jobQueue.listJobs().filter((job) => matchesWorkspace(job, workspaceId))
      res.json(jobs)
    }
  )

  router.get(
    '/jobs/:id',
    auth.requirePermission('jobs', 'read', 'viewer'),
    (req, res) => {
      const job = jobQueue.getJob(req.params.id)
      if (!job || !matchesWorkspace(job, req.workspace?.id || null)) {
        return res.status(404).json({ error: 'Job not found' })
      }
      res.json(job)
    }
  )

  router.post(
    '/jobs/:id/cancel',
    auth.requirePermission('jobs', 'update', 'editor'),
    (req, res) => {
      const job = jobQueue.cancelJob(req.params.id)
      if (!job || !matchesWorkspace(job, req.workspace?.id || null)) {
        return res.status(404).json({ success: false, error: 'Job not found' })
      }
      res.json({ success: true, job })
    }
  )

  router.post(
    '/jobs',
    auth.requirePermission('jobs', 'create', 'editor'),
    validate(createJobSchema),
    (req, res) => {
      const { type, payload } = req.body
      const job = jobQueue.enqueueJob({
        type,
        payload: {
          ...(payload || {}),
          workspaceId: req.workspace?.id || null,
          reposRoot: req.workspace?.reposRoot || null,
          outputDir: req.workspace?.outputDir || null,
        },
        createdBy: req.user?.username || null,
        workspaceId: req.workspace?.id || null,
      })
      audit('jobs.create', { id: job.id, type }, req)
      res.json({ success: true, job })
    }
  )

  return router
}

module.exports = createJobRoutes
