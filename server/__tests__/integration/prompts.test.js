const request = require('supertest')

let app

beforeAll(() => {
  app = require('../../index')
})

describe('Prompts API', () => {
  let createdPromptId

  describe('GET /api/prompts', () => {
    it('returns an array of prompts', async () => {
      const res = await request(app).get('/api/prompts')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /api/prompts', () => {
    it('creates a new prompt', async () => {
      const res = await request(app)
        .post('/api/prompts')
        .send({ title: 'Test Prompt', query: 'Build a REST API for user management' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.prompt).toHaveProperty('id')
      expect(res.body.prompt.title).toBe('Test Prompt')
      expect(res.body.prompt.query).toBe('Build a REST API for user management')
      createdPromptId = res.body.prompt.id
    })

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/prompts')
        .send({ title: '' })
      // Should fail Zod validation (missing query, empty title)
      expect([400, 422]).toContain(res.status)
    })

    it('accepts prompt without title (title is optional)', async () => {
      const res = await request(app)
        .post('/api/prompts')
        .send({ query: 'Some query without title' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.prompt.query).toBe('Some query without title')
    })

    it('rejects missing query', async () => {
      const res = await request(app)
        .post('/api/prompts')
        .send({ title: 'Some title' })
      expect([400, 422]).toContain(res.status)
    })
  })

  describe('PUT /api/prompts/:id', () => {
    it('updates an existing prompt', async () => {
      // First create one to ensure we have an ID
      const createRes = await request(app)
        .post('/api/prompts')
        .send({ title: 'Original', query: 'Original query' })
      const id = createRes.body.prompt.id

      const res = await request(app)
        .put(`/api/prompts/${id}`)
        .send({ title: 'Updated Title', query: 'Updated query' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.prompt.title).toBe('Updated Title')
    })

    it('returns 404 for non-existent prompt', async () => {
      const res = await request(app)
        .put('/api/prompts/nonexistent-id-12345')
        .send({ title: 'Updated', query: 'Updated query' })
      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })
  })

  describe('DELETE /api/prompts/:id', () => {
    it('deletes an existing prompt', async () => {
      // Create one first
      const createRes = await request(app)
        .post('/api/prompts')
        .send({ title: 'To Delete', query: 'Delete me' })
      const id = createRes.body.prompt.id

      const res = await request(app).delete(`/api/prompts/${id}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Verify it's gone
      const listRes = await request(app).get('/api/prompts')
      const found = listRes.body.find((p) => p.id === id)
      expect(found).toBeUndefined()
    })

    it('returns 404 for non-existent prompt', async () => {
      const res = await request(app).delete('/api/prompts/nonexistent-id-99999')
      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /api/agents', () => {
    it('returns an array (may be empty)', async () => {
      const res = await request(app).get('/api/agents')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('GET /api/tools', () => {
    it('returns an array (may be empty)', async () => {
      const res = await request(app).get('/api/tools')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})
