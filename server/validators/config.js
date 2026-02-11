const { z } = require('zod')

const configUpdateSchema = z
  .object({
    reposRoot: z.string().max(1000).optional(),
    outputDir: z.string().max(1000).optional(),
    modelDir: z.string().max(1000).optional(),
    llm: z
      .object({
        provider: z.string().max(100).optional(),
        endpoint: z.string().max(500).optional(),
        model: z.string().max(200).optional(),
        apiKey: z.string().max(500).optional(),
        allowRemote: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    auth: z
      .object({
        enabled: z.boolean().optional(),
        bootstrapAllowed: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    ui: z.object({}).passthrough().optional(),
    queue: z
      .object({
        enabled: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    vectorIndex: z.object({}).passthrough().optional(),
    observability: z.object({}).passthrough().optional(),
    decisionMatrix: z.object({}).passthrough().optional(),
    evaluation: z.object({}).passthrough().optional(),
    workspaces: z.object({}).passthrough().optional(),
  })
  .passthrough()

module.exports = { configUpdateSchema }
