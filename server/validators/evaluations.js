const { z } = require('zod')

const createEvaluationSchema = z.object({
  datasetId: z.string().min(1, 'datasetId is required').max(200),
  runId: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
})

const createEvalTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(2000).optional(),
  rubric: z.string().max(10000).optional(),
  expectedType: z.string().max(100).optional(),
})

const updateEvalTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  rubric: z.string().max(10000).optional(),
  expectedType: z.string().max(100).optional(),
})

module.exports = { createEvaluationSchema, createEvalTemplateSchema, updateEvalTemplateSchema }
