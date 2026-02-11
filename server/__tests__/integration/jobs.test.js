const request = require('supertest')

let app

beforeAll(() => {
  app = require('../../index')
})

describe('Jobs API', () => {
  let createdJobId

  describe('GET /api/jobs', () => {
    it('returns an array of jobs', async () => {
      const res = await request(app).get('/api/jobs')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /api/jobs', () => {
    it('creates a new job with valid type', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({ type: 'test-job', payload: { foo: 'bar' } })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.job).toHaveProperty('id')
      expect(res.body.job.type).toBe('test-job')
      createdJobId = res.body.job.id
    })

    it('validates required type field', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({ payload: { foo: 'bar' } })
      // Zod validation should reject missing type
      expect([400, 422]).toContain(res.status)
    })

    it('rejects empty type string', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({ type: '' })
      expect([400, 422]).toContain(res.status)
    })
  })

  describe('GET /api/jobs/:id', () => {
    it('returns a specific job by ID', async () => {
      // Create a job first to get a valid ID
      const createRes = await request(app)
        .post('/api/jobs')
        .send({ type: 'lookup-test' })
      const id = createRes.body.job.id

      const res = await request(app).get(`/api/jobs/${id}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('id', id)
      expect(res.body).toHaveProperty('type', 'lookup-test')
    })

    it('returns 404 for non-existent job', async () => {
      const res = await request(app).get('/api/jobs/nonexistent-job-id-99999')
      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })
  })

  describe('POST /api/jobs/:id/cancel', () => {
    it('cancels an existing job', async () => {
      // Create a job first
      const createRes = await request(app)
        .post('/api/jobs')
        .send({ type: 'cancel-test' })
      const id = createRes.body.job.id

      const res = await request(app).post(`/api/jobs/${id}/cancel`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.job).toHaveProperty('id', id)
    })

    it('returns 404 when cancelling non-existent job', async () => {
      const res = await request(app).post('/api/jobs/nonexistent-cancel-99999/cancel')
      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })
  })
})
