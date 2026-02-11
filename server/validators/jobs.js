const { z } = require('zod')

const createJobSchema = z.object({
  type: z.string().min(1, 'Job type is required').max(100),
  payload: z.object({}).passthrough().optional(),
})

module.exports = { createJobSchema }
