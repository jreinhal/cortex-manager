const { bootstrapSchema, loginSchema } = require('../validators/auth')
const { configUpdateSchema } = require('../validators/config')
const { setupSchema, validatePathSchema, llmPingSchema } = require('../validators/setup')
const { addRepoSchema } = require('../validators/repos')
const { spawnSchema } = require('../validators/spawn')
const { createWorkspaceSchema, updateWorkspaceSchema } = require('../validators/workspaces')
const { createUserSchema, updateUserSchema } = require('../validators/users')
const { createJobSchema } = require('../validators/jobs')
const {
  createDatasetSchema,
  updateDatasetSchema,
  addDatasetItemSchema,
} = require('../validators/datasets')
const {
  createEvaluationSchema,
  createEvalTemplateSchema,
  updateEvalTemplateSchema,
} = require('../validators/evaluations')
const { createPromptSchema, updatePromptSchema } = require('../validators/prompts')
const { createSessionSchema } = require('../validators/sessions')

describe('auth schemas', () => {
  describe('bootstrapSchema', () => {
    it('accepts valid bootstrap data', () => {
      const result = bootstrapSchema.safeParse({
        username: 'admin',
        password: 'secret123',
      })
      expect(result.success).toBe(true)
    })

    it('accepts optional workspaceId', () => {
      const result = bootstrapSchema.safeParse({
        username: 'admin',
        password: 'secret',
        workspaceId: 'ws-1',
      })
      expect(result.success).toBe(true)
      expect(result.data.workspaceId).toBe('ws-1')
    })

    it('rejects empty username', () => {
      const result = bootstrapSchema.safeParse({
        username: '',
        password: 'secret',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing password', () => {
      const result = bootstrapSchema.safeParse({ username: 'admin' })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const result = loginSchema.safeParse({
        username: 'user',
        password: 'pass',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing fields', () => {
      expect(loginSchema.safeParse({}).success).toBe(false)
      expect(loginSchema.safeParse({ username: 'u' }).success).toBe(false)
      expect(loginSchema.safeParse({ password: 'p' }).success).toBe(false)
    })
  })
})

describe('config schemas', () => {
  it('accepts partial config updates', () => {
    const result = configUpdateSchema.safeParse({ reposRoot: '/path/to/repos' })
    expect(result.success).toBe(true)
  })

  it('accepts nested llm config', () => {
    const result = configUpdateSchema.safeParse({
      llm: { provider: 'openai', model: 'gpt-4' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = configUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('setup schemas', () => {
  describe('setupSchema', () => {
    it('accepts valid setup', () => {
      const result = setupSchema.safeParse({ reposRoot: '/path/to/repos' })
      expect(result.success).toBe(true)
      expect(result.data.createStructure).toBe(false)
    })

    it('accepts createStructure flag', () => {
      const result = setupSchema.safeParse({
        reposRoot: '/path',
        createStructure: true,
      })
      expect(result.success).toBe(true)
      expect(result.data.createStructure).toBe(true)
    })

    it('rejects missing reposRoot', () => {
      const result = setupSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects empty reposRoot', () => {
      const result = setupSchema.safeParse({ reposRoot: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('validatePathSchema', () => {
    it('accepts valid path', () => {
      const result = validatePathSchema.safeParse({ path: '/some/path' })
      expect(result.success).toBe(true)
    })

    it('rejects missing path', () => {
      const result = validatePathSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('llmPingSchema', () => {
    it('accepts all optional fields', () => {
      const result = llmPingSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts endpoint and model', () => {
      const result = llmPingSchema.safeParse({
        endpoint: 'http://localhost:1234',
        model: 'llama-3',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('repos schemas', () => {
  it('accepts valid URL', () => {
    const result = addRepoSchema.safeParse({
      url: 'https://github.com/user/repo.git',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty URL', () => {
    const result = addRepoSchema.safeParse({ url: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing URL', () => {
    const result = addRepoSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('spawn schemas', () => {
  it('accepts valid spawn', () => {
    const result = spawnSchema.safeParse({ goal: 'Build a REST API' })
    expect(result.success).toBe(true)
    expect(result.data.format).toBe('universal')
  })

  it('accepts format override', () => {
    const result = spawnSchema.safeParse({
      goal: 'Build an API',
      format: 'claude',
    })
    expect(result.success).toBe(true)
    expect(result.data.format).toBe('claude')
  })

  it('rejects invalid format', () => {
    const result = spawnSchema.safeParse({
      goal: 'Build',
      format: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing goal', () => {
    const result = spawnSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts externalSkills options', () => {
    const result = spawnSchema.safeParse({
      goal: 'Test',
      externalSkills: { online: true, trainingMode: 'retrieval' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts long goals up to the configured max size', () => {
    const result = spawnSchema.safeParse({
      goal: 'a'.repeat(120000),
    })
    expect(result.success).toBe(true)
  })
})

describe('workspace schemas', () => {
  it('accepts valid workspace creation', () => {
    const result = createWorkspaceSchema.safeParse({
      name: 'My Workspace',
      reposRoot: '/path/to/repos',
    })
    expect(result.success).toBe(true)
  })

  it('rejects workspace without reposRoot', () => {
    const result = createWorkspaceSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('accepts workspace update with partial fields', () => {
    const result = updateWorkspaceSchema.safeParse({ name: 'Updated' })
    expect(result.success).toBe(true)
  })
})

describe('user schemas', () => {
  it('accepts valid user creation', () => {
    const result = createUserSchema.safeParse({
      username: 'newuser',
      password: 'pass123',
    })
    expect(result.success).toBe(true)
    expect(result.data.role).toBe('viewer')
  })

  it('accepts role override', () => {
    const result = createUserSchema.safeParse({
      username: 'admin2',
      password: 'pass',
      role: 'admin',
    })
    expect(result.success).toBe(true)
    expect(result.data.role).toBe('admin')
  })

  it('rejects invalid role', () => {
    const result = createUserSchema.safeParse({
      username: 'test',
      password: 'test',
      role: 'superadmin',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid user update', () => {
    const result = updateUserSchema.safeParse({ role: 'editor' })
    expect(result.success).toBe(true)
  })

  it('rejects empty user update', () => {
    const result = updateUserSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts disabled flag in update', () => {
    const result = updateUserSchema.safeParse({ disabled: true })
    expect(result.success).toBe(true)
  })
})

describe('job schemas', () => {
  it('accepts valid job creation', () => {
    const result = createJobSchema.safeParse({ type: 'vector-index' })
    expect(result.success).toBe(true)
  })

  it('accepts job with payload', () => {
    const result = createJobSchema.safeParse({
      type: 'spawn',
      payload: { goal: 'test' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const result = createJobSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('dataset schemas', () => {
  it('accepts valid dataset creation', () => {
    const result = createDatasetSchema.safeParse({ name: 'Test Dataset' })
    expect(result.success).toBe(true)
    expect(result.data.benchmarkType).toBe('response')
  })

  it('accepts retrieval benchmark type', () => {
    const result = createDatasetSchema.safeParse({
      name: 'Retrieval Test',
      benchmarkType: 'retrieval',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid benchmark type', () => {
    const result = createDatasetSchema.safeParse({
      name: 'Test',
      benchmarkType: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts dataset update', () => {
    const result = updateDatasetSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('accepts valid dataset item', () => {
    const result = addDatasetItemSchema.safeParse({
      input: 'What is 2+2?',
      expected: '4',
    })
    expect(result.success).toBe(true)
  })

  it('rejects dataset item without input', () => {
    const result = addDatasetItemSchema.safeParse({ expected: '4' })
    expect(result.success).toBe(false)
  })

  it('accepts item with tags and weight', () => {
    const result = addDatasetItemSchema.safeParse({
      input: 'Test',
      tags: ['math', 'basic'],
      weight: 1.5,
    })
    expect(result.success).toBe(true)
  })
})

describe('evaluation schemas', () => {
  it('accepts valid evaluation', () => {
    const result = createEvaluationSchema.safeParse({
      datasetId: 'ds-123',
      runId: 'run-456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing datasetId', () => {
    const result = createEvaluationSchema.safeParse({ runId: 'run-1' })
    expect(result.success).toBe(false)
  })

  it('accepts eval template creation', () => {
    const result = createEvalTemplateSchema.safeParse({
      name: 'Quality Check',
      rubric: 'Check accuracy and completeness',
    })
    expect(result.success).toBe(true)
  })

  it('rejects eval template without name', () => {
    const result = createEvalTemplateSchema.safeParse({ rubric: 'test' })
    expect(result.success).toBe(false)
  })

  it('accepts eval template update', () => {
    const result = updateEvalTemplateSchema.safeParse({
      description: 'Updated desc',
    })
    expect(result.success).toBe(true)
  })
})

describe('prompt schemas', () => {
  it('accepts valid prompt creation', () => {
    const result = createPromptSchema.safeParse({
      title: 'My Prompt',
      query: 'Build a REST API with Node.js',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing query', () => {
    const result = createPromptSchema.safeParse({ title: 'Test' })
    expect(result.success).toBe(false)
  })

  it('accepts prompt with only query', () => {
    const result = createPromptSchema.safeParse({ query: 'Build something' })
    expect(result.success).toBe(true)
  })

  it('accepts prompt update', () => {
    const result = updatePromptSchema.safeParse({ title: 'Updated Title' })
    expect(result.success).toBe(true)
  })
})

describe('session schemas', () => {
  it('accepts valid session', () => {
    const result = createSessionSchema.safeParse({
      goal: 'Test goal',
      agent: 'claude',
      resources: 5,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty session', () => {
    const result = createSessionSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects non-integer resources', () => {
    const result = createSessionSchema.safeParse({ resources: 'five' })
    expect(result.success).toBe(false)
  })
})
