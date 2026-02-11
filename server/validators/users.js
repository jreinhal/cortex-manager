const { z } = require('zod')

const validRoles = ['viewer', 'editor', 'admin']

const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(500),
  role: z.enum(validRoles).optional().default('viewer'),
  workspaceId: z.string().max(200).optional().nullable(),
})

const updateUserSchema = z
  .object({
    username: z.string().min(1).max(100).optional(),
    password: z.string().min(1).max(500).optional(),
    role: z.enum(validRoles).optional(),
    workspaceId: z.string().max(200).optional().nullable(),
    disabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

module.exports = { createUserSchema, updateUserSchema }
