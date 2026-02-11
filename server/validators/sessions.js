const { z } = require('zod')

const createSessionSchema = z.object({
  goal: z.string().max(10000).optional(),
  agent: z.string().max(200).optional(),
  resources: z.number().int().min(0).optional(),
  output: z.string().max(100000).optional(),
})

module.exports = { createSessionSchema }
