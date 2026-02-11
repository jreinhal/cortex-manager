const express = require('express')
const path = require('path')
const { validate } = require('../middleware/validate')
const {
  createEvaluationSchema,
  createEvalTemplateSchema,
  updateEvalTemplateSchema,
} = require('../validators/evaluations')
const { createDatasetSchema, updateDatasetSchema, addDatasetItemSchema } = require('../validators/datasets')
const {
  audit,
  matchesWorkspace,
  readRunOutput,
  computeEvaluationMetrics,
  scoreDatasetItem,
  summarizeEvaluation,
  normalizePathValue,
  parseExpectedPaths,
} = require('./helpers')

function createEvaluationRoutes({
  config,
  auth,
  datasetsStore,
  evaluationsStore,
  evaluationTemplatesStore,
  runsStore,
}) {
  const router = express.Router()
  const { gradeItemWithLlm } = require('../evaluation-grader')
  const { estimateTokens, estimateCost } = require('../token-estimator')
  const { analyzeGoal } = require('../goal-analyzer')
  const { findResources } = require('../resource-matcher')

  async function runRetrievalBenchmark({ dataset, reposRoot, decisionConfig, vectorConfig, workspaceId, topK = 5 }) {
    const items = []
    const scoring = []
    for (const item of dataset.items || []) {
      const expectedPaths = parseExpectedPaths(item)
      if (expectedPaths.length === 0) {
        items.push({
          id: item.id,
          input: item.input,
          expectedPaths: [],
          status: 'needs-review',
          precision: 0,
          recall: 0,
          mrr: 0,
          matches: [],
        })
        continue
      }

      const analysis = analyzeGoal(item.input || '', { decisionConfig })
      const resources = await findResources(analysis, reposRoot, {
        maxResults: Math.max(topK, decisionConfig.maxCandidates || 6),
        minScore: 0.1,
        rrf: decisionConfig.rrf || {},
        ragFusion: decisionConfig.ragFusion || {},
        hyde: decisionConfig.hyde || {},
        hybrid: decisionConfig.hybridRetrieval || {},
        vectorIndex: vectorConfig || {},
        retrievalEnabled: true,
        workspaceId,
      })

      const flattened = ['knowledge', 'skills', 'tools']
        .flatMap((cat) => resources[cat] || [])
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((resource, idx) => {
          const relativePath = normalizePathValue(
            resource.relativePath || path.relative(reposRoot, resource.filePath || '')
          )
          return {
            rank: idx + 1,
            filePath: resource.filePath,
            relativePath,
            score: resource.score,
          }
        })

      const matches = flattened.filter((result) =>
        expectedPaths.some((expected) => result.relativePath.endsWith(expected) || result.relativePath.includes(expected))
      )
      const hitCount = matches.length
      const precision = topK > 0 ? hitCount / topK : 0
      const recall = expectedPaths.length > 0 ? hitCount / expectedPaths.length : 0
      const firstHitRank = matches.length > 0 ? matches[0].rank : null
      const mrr = firstHitRank ? 1 / firstHitRank : 0

      items.push({
        id: item.id,
        input: item.input,
        expectedPaths,
        status: hitCount > 0 ? 'pass' : 'fail',
        precision,
        recall,
        mrr,
        matches: flattened,
      })

      scoring.push({ precision, recall, mrr })
    }

    const scoredCount = scoring.length
    const avg = (key) =>
      scoredCount > 0 ? scoring.reduce((sum, entry) => sum + entry[key], 0) / scoredCount : 0
    return {
      items,
      metrics: {
        topK,
        itemCount: dataset.items?.length || 0,
        scoredCount,
        precisionAtK: avg('precision'),
        recallAtK: avg('recall'),
        mrr: avg('mrr'),
        score: Math.round(avg('recall') * 100),
      },
    }
  }

  // Datasets
  router.get(
    '/datasets',
    auth.requirePermission('datasets', 'read', 'viewer'),
    (req, res) => {
      const datasets = datasetsStore.loadDatasets()
      const workspaceId = req.workspace?.id || null
      res.json(datasets.filter((dataset) => matchesWorkspace(dataset, workspaceId)))
    }
  )

  router.get(
    '/datasets/:id',
    auth.requirePermission('datasets', 'read', 'viewer'),
    (req, res) => {
      const dataset = datasetsStore.getDataset(req.params.id)
      if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
        return res.status(404).json({ error: 'Dataset not found' })
      }
      res.json(dataset)
    }
  )

  router.get(
    '/datasets/:id/export',
    auth.requirePermission('datasets', 'export', 'viewer'),
    (req, res) => {
      const dataset = datasetsStore.getDataset(req.params.id)
      if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
        return res.status(404).json({ error: 'Dataset not found' })
      }
      const safeName = (dataset.name || 'dataset').replace(/[^a-z0-9-_]+/gi, '_')
      audit('datasets.export', { id: dataset.id, name: dataset.name }, req)
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`)
      res.json({ dataset })
    }
  )

  router.post(
    '/datasets',
    auth.requirePermission('datasets', 'create', 'editor'),
    validate(createDatasetSchema),
    (req, res) => {
      const { name, description, benchmarkType } = req.body
      const dataset = datasetsStore.createDataset({
        name,
        description,
        benchmarkType,
        workspaceId: req.workspace?.id || null,
      })
      audit('datasets.create', { id: dataset.id, name: dataset.name }, req)
      res.json({ success: true, dataset })
    }
  )

  router.post(
    '/datasets/import',
    auth.requirePermission('datasets', 'import', 'editor'),
    (req, res) => {
      const payload = req.body?.dataset || req.body
      if (!payload || !payload.name) {
        return res.status(400).json({ success: false, error: 'Dataset payload with name is required' })
      }

      const dataset = datasetsStore.importDataset(payload, req.workspace?.id || null)
      if (!dataset) {
        return res.status(500).json({ success: false, error: 'Failed to import dataset' })
      }
      audit('datasets.import', { id: dataset.id, name: dataset.name }, req)
      res.json({ success: true, dataset })
    }
  )

  router.put(
    '/datasets/:id',
    auth.requirePermission('datasets', 'update', 'editor'),
    validate(updateDatasetSchema),
    (req, res) => {
      const { name, description, benchmarkType } = req.body || {}
      const existing = datasetsStore.getDataset(req.params.id)
      if (!existing || !matchesWorkspace(existing, req.workspace?.id || null)) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      const updated = datasetsStore.updateDataset(req.params.id, { name, description, benchmarkType })
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      audit('datasets.update', { id: updated.id, name: updated.name }, req)
      res.json({ success: true, dataset: updated })
    }
  )

  router.delete(
    '/datasets/:id',
    auth.requirePermission('datasets', 'delete', 'editor'),
    (req, res) => {
      const existing = datasetsStore.getDataset(req.params.id)
      if (!existing || !matchesWorkspace(existing, req.workspace?.id || null)) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      const success = datasetsStore.deleteDataset(req.params.id)
      if (!success) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      audit('datasets.delete', { id: req.params.id }, req)
      res.json({ success: true })
    }
  )

  router.post(
    '/datasets/:id/items',
    auth.requirePermission('datasets', 'update', 'editor'),
    validate(addDatasetItemSchema),
    (req, res) => {
      const { input, expected, tags, weight, expectedType, rubric, expectedPaths } = req.body
      const dataset = datasetsStore.getDataset(req.params.id)
      if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      const item = datasetsStore.addDatasetItem(req.params.id, {
        input,
        expected,
        tags,
        weight,
        expectedType,
        rubric,
        expectedPaths,
      })
      if (!item) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      audit('datasets.item.add', { datasetId: req.params.id, itemId: item.id }, req)
      res.json({ success: true, item })
    }
  )

  router.delete(
    '/datasets/:id/items/:itemId',
    auth.requirePermission('datasets', 'update', 'editor'),
    (req, res) => {
      const dataset = datasetsStore.getDataset(req.params.id)
      if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      const success = datasetsStore.removeDatasetItem(req.params.id, req.params.itemId)
      if (!success) {
        return res.status(404).json({ success: false, error: 'Item not found' })
      }
      audit('datasets.item.remove', { datasetId: req.params.id, itemId: req.params.itemId }, req)
      res.json({ success: true })
    }
  )

  // Evaluation Templates
  router.get(
    '/evaluation-templates',
    auth.requirePermission('evaluation_templates', 'read', 'viewer'),
    (req, res) => {
      res.json(evaluationTemplatesStore.loadTemplates())
    }
  )

  router.get(
    '/evaluation-templates/export',
    auth.requirePermission('evaluation_templates', 'export', 'viewer'),
    (req, res) => {
      const templates = evaluationTemplatesStore.loadTemplates()
      res.json({ templates })
    }
  )

  router.post(
    '/evaluation-templates/import',
    auth.requirePermission('evaluation_templates', 'import', 'editor'),
    (req, res) => {
      const payload = req.body?.templates || req.body?.template || req.body
      const created = evaluationTemplatesStore.importTemplates(payload)
      audit('evaluationTemplates.import', { count: created.length }, req)
      res.json({ success: true, templates: created })
    }
  )

  router.post(
    '/evaluation-templates',
    auth.requirePermission('evaluation_templates', 'create', 'editor'),
    validate(createEvalTemplateSchema),
    (req, res) => {
      const { name, description, rubric, expectedType } = req.body
      const template = evaluationTemplatesStore.createTemplate({ name, description, rubric, expectedType })
      audit('evaluationTemplates.create', { id: template.id, name: template.name }, req)
      res.json({ success: true, template })
    }
  )

  router.put(
    '/evaluation-templates/:id',
    auth.requirePermission('evaluation_templates', 'update', 'editor'),
    validate(updateEvalTemplateSchema),
    (req, res) => {
      const updated = evaluationTemplatesStore.updateTemplate(req.params.id, req.body || {})
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Template not found' })
      }
      audit('evaluationTemplates.update', { id: updated.id, name: updated.name }, req)
      res.json({ success: true, template: updated })
    }
  )

  router.delete(
    '/evaluation-templates/:id',
    auth.requirePermission('evaluation_templates', 'delete', 'editor'),
    (req, res) => {
      const success = evaluationTemplatesStore.deleteTemplate(req.params.id)
      if (!success) {
        return res.status(404).json({ success: false, error: 'Template not found' })
      }
      audit('evaluationTemplates.delete', { id: req.params.id }, req)
      res.json({ success: true })
    }
  )

  // Evaluations
  router.get(
    '/evaluations',
    auth.requirePermission('evaluations', 'read', 'viewer'),
    (req, res) => {
      const evaluations = evaluationsStore.loadEvaluations()
      const workspaceId = req.workspace?.id || null
      res.json(evaluations.filter((evaluation) => matchesWorkspace(evaluation, workspaceId)))
    }
  )

  router.post(
    '/evaluations',
    auth.requirePermission('evaluations', 'create', 'editor'),
    validate(createEvaluationSchema),
    async (req, res) => {
      const { datasetId, runId, name } = req.body
      const dataset = datasetsStore.getDataset(datasetId)
      const run = runId ? runsStore.getRun(runId) : null
      if (!dataset || !matchesWorkspace(dataset, req.workspace?.id || null)) {
        return res.status(404).json({ success: false, error: 'Dataset not found' })
      }
      const isRetrievalBenchmark = dataset.benchmarkType === 'retrieval'
      if (!isRetrievalBenchmark) {
        if (!runId) {
          return res.status(400).json({ success: false, error: 'runId is required for response evaluations' })
        }
        if (!run || !matchesWorkspace(run, req.workspace?.id || null)) {
          return res.status(404).json({ success: false, error: 'Run not found' })
        }
      }

      const fullConfig = config.getConfig()
      const evaluationConfig = fullConfig.evaluation || {}
      const llmConfig = fullConfig.llm || {}
      const decisionConfig = fullConfig.decisionMatrix || {}
      if (isRetrievalBenchmark) {
        const benchmarkTopK = evaluationConfig.benchmarkTopK ?? 5
        const benchmark = await runRetrievalBenchmark({
          dataset,
          reposRoot: req.workspace?.reposRoot || fullConfig.reposRoot,
          decisionConfig,
          vectorConfig: fullConfig.vectorIndex || {},
          workspaceId: req.workspace?.id || null,
          topK: benchmarkTopK,
        })

        const passThreshold = evaluationConfig.passThreshold ?? 0.75
        const warnThreshold = evaluationConfig.warnThreshold ?? 0.6
        const passRate = benchmark.metrics.recallAtK
        let status = 'needs-review'
        if (benchmark.metrics.scoredCount > 0) {
          if (passRate >= passThreshold) status = 'pass'
          else if (passRate >= warnThreshold) status = 'warn'
          else status = 'fail'
        }

        const evaluation = {
          id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: name || `${dataset.name} \u2022 Retrieval benchmark`,
          type: 'retrieval',
          datasetId,
          datasetName: dataset.name,
          datasetVersion: dataset.version || 1,
          datasetUpdatedAt: dataset.updatedAt || dataset.createdAt,
          runId: null,
          runGoal: null,
          createdAt: new Date().toISOString(),
          workspaceId: req.workspace?.id || null,
          status,
          metrics: {
            ...benchmark.metrics,
            passRate,
            status,
          },
          usage: {
            tokensEstimated: 0,
            costEstimated: 0,
            currency: llmConfig.currency || 'USD',
            llmCalls: 0,
          },
          items: benchmark.items,
        }

        evaluationsStore.recordEvaluation(evaluation)
        audit('evaluations.create', { id: evaluation.id, datasetId }, req)
        return res.json({ success: true, evaluation })
      }

      const maxChars = evaluationConfig.maxOutputChars ?? 120000
      const output = await readRunOutput(run, maxChars)
      const llmEnabled = evaluationConfig.llmGraderEnabled !== false && llmConfig.enabled === true
      const maxLlmItems = evaluationConfig.llmMaxItems ?? 12
      let llmUsedCount = 0
      let llmTokensEstimated = 0
      const items = []

      for (const item of dataset.items || []) {
        const wantsLlm = item.expectedType === 'llm' || Boolean(item.rubric)
        if (llmEnabled && wantsLlm && llmUsedCount < maxLlmItems) {
          const graded = await gradeItemWithLlm({ run, item, output, llmConfig, decisionConfig })
          if (graded.used) {
            llmUsedCount += 1
            const outputSnippet = output.length > 2000 ? output.slice(0, 2000) : output
            llmTokensEstimated += estimateTokens(
              `${run.goal}\n${item.input}\n${item.expected || ''}\n${item.rubric || ''}\n${outputSnippet}`
            )
            items.push({
              id: item.id,
              input: item.input,
              expected: item.expected,
              expectedType: item.expectedType || 'llm',
              rubric: item.rubric || null,
              weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1,
              score: graded.score,
              status: graded.status,
              method: 'llm',
              notes: graded.rationale || null,
            })
            continue
          }
        }

        items.push(scoreDatasetItem(run, item, output))
      }
      const summary = summarizeEvaluation(items, {
        passThreshold: evaluationConfig.passThreshold ?? 0.75,
        warnThreshold: evaluationConfig.warnThreshold ?? 0.6,
      })
      const metrics = {
        ...computeEvaluationMetrics(run, dataset),
        passRate: summary.passRate,
        score: summary.score,
        status: summary.status,
        scoredCount: summary.scoredCount,
        needsReviewCount: summary.needsReviewCount,
        llmCalls: llmUsedCount,
      }
      const llmCostEstimated = estimateCost(llmTokensEstimated, llmConfig)
      const evaluation = {
        id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name || `${dataset.name} \u2022 ${new Date().toLocaleDateString()}`,
        type: 'response',
        datasetId,
        datasetName: dataset.name,
        datasetVersion: dataset.version || 1,
        datasetUpdatedAt: dataset.updatedAt || dataset.createdAt,
        runId,
        runGoal: run.goal,
        createdAt: new Date().toISOString(),
        workspaceId: req.workspace?.id || null,
        status: summary.status,
        metrics,
        usage: {
          tokensEstimated: llmTokensEstimated,
          costEstimated: llmCostEstimated,
          currency: llmConfig.currency || 'USD',
          llmCalls: llmUsedCount,
        },
        items,
      }

      evaluationsStore.recordEvaluation(evaluation)
      audit('evaluations.create', { id: evaluation.id, datasetId, runId }, req)
      res.json({ success: true, evaluation })
    }
  )

  router.get(
    '/evaluations/compare',
    auth.requirePermission('evaluations', 'compare', 'viewer'),
    (req, res) => {
      const leftId = req.query.left
      const rightId = req.query.right
      if (!leftId || !rightId) {
        return res.status(400).json({ error: 'left and right evaluation ids are required' })
      }
      const left = evaluationsStore.getEvaluation(leftId)
      const right = evaluationsStore.getEvaluation(rightId)
      if (!left || !right) {
        return res.status(404).json({ error: 'Evaluation not found' })
      }
      if (
        !matchesWorkspace(left, req.workspace?.id || null) ||
        !matchesWorkspace(right, req.workspace?.id || null)
      ) {
        return res.status(404).json({ error: 'Evaluation not found' })
      }

      const delta = {
        score: (right.metrics?.score ?? 0) - (left.metrics?.score ?? 0),
        passRate: (right.metrics?.passRate ?? 0) - (left.metrics?.passRate ?? 0),
        itemCount: (right.metrics?.itemCount ?? 0) - (left.metrics?.itemCount ?? 0),
      }

      audit('evaluations.compare', { leftId, rightId }, req)
      res.json({
        left,
        right,
        delta,
        meta: {
          datasetMismatch: left.datasetId !== right.datasetId,
          datasetVersionMismatch: left.datasetVersion !== right.datasetVersion,
        },
      })
    }
  )

  return router
}

module.exports = createEvaluationRoutes
