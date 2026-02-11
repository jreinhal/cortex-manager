const { z } = require('zod')

const createPromptSchema = z.object({
  title: z.string().max(200).optional(),
  query: z.string().min(1, 'Query is required').max(50000),
})

const updatePromptSchema = z.object({
  title: z.string().max(200).optional(),
  query: z.string().max(50000).optional(),
})

module.exports = { createPromptSchema, updatePromptSchema }
