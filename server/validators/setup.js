const { z } = require('zod')

const setupSchema = z.object({
  reposRoot: z.string().min(1, 'reposRoot is required').max(1000),
  createStructure: z.boolean().optional().default(false),
})

const validatePathSchema = z.object({
  path: z.string().min(1, 'Path is required').max(1000),
})

const llmPingSchema = z.object({
  endpoint: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  provider: z.string().max(100).optional(),
})

module.exports = { setupSchema, validatePathSchema, llmPingSchema }
