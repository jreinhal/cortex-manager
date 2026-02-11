const { z } = require('zod')

const createWorkspaceSchema = z.object({
  id: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  reposRoot: z.string().min(1, 'reposRoot is required').max(1000),
  outputDir: z.string().max(1000).optional(),
  createStructure: z.boolean().optional().default(false),
})

const updateWorkspaceSchema = z.object({
  name: z.string().max(200).optional(),
  reposRoot: z.string().max(1000).optional(),
  outputDir: z.string().max(1000).optional(),
  createStructure: z.boolean().optional().default(false),
})

module.exports = { createWorkspaceSchema, updateWorkspaceSchema }
