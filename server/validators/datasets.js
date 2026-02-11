const { z } = require('zod')

const createDatasetSchema = z.object({
  name: z.string().min(1, 'Dataset name is required').max(200),
  description: z.string().max(2000).optional(),
  benchmarkType: z.enum(['response', 'retrieval']).optional().default('response'),
})

const updateDatasetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  benchmarkType: z.enum(['response', 'retrieval']).optional(),
})

const addDatasetItemSchema = z.object({
  input: z.string().min(1, 'Item input is required').max(50000),
  expected: z.string().max(50000).optional(),
  tags: z.array(z.string().max(100)).optional(),
  weight: z.number().min(0).max(100).optional(),
  expectedType: z.string().max(100).optional(),
  rubric: z.string().max(10000).optional(),
  expectedPaths: z.array(z.string().max(1000)).optional(),
})

module.exports = { createDatasetSchema, updateDatasetSchema, addDatasetItemSchema }
