const { z } = require('zod')

const spawnSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(10000),
  format: z.enum(['universal', 'chatgpt', 'claude', 'gemini']).optional().default('universal'),
  async: z.boolean().optional(),
  externalSkills: z
    .object({
      online: z.boolean().optional(),
      trainingMode: z.string().max(100).optional(),
    })
    .optional(),
})

module.exports = { spawnSchema }
