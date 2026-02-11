const { z } = require('zod')

const bootstrapSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(500),
  workspaceId: z.string().max(200).optional().nullable(),
})

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(500),
})

module.exports = { bootstrapSchema, loginSchema }
