const { z } = require('zod')

const MAX_GOAL_CHARS = 120000

const spawnSchema = z.object({
  goal: z
    .string()
    .min(1, 'Goal is required')
    .max(MAX_GOAL_CHARS, `Goal is too long (max ${MAX_GOAL_CHARS.toLocaleString()} characters)`),
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
