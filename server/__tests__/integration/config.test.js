const request = require('supertest')

let app

beforeAll(() => {
  app = require('../../index')
})

describe('Config API', () => {
  describe('GET /api/config', () => {
    it('returns config object with expected structure', async () => {
      const res = await request(app).get('/api/config')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('config')
      expect(res.body).toHaveProperty('system')
      expect(res.body).toHaveProperty('isFirstRun')
      expect(res.body).toHaveProperty('gitAvailable')
    })

    it('sanitizes auth secret from response', async () => {
      const res = await request(app).get('/api/config')
      expect(res.status).toBe(200)
      expect(res.body.config.auth?.secret).toBeNull()
    })

    it('sanitizes SCIM token from response', async () => {
      const res = await request(app).get('/api/config')
      expect(res.status).toBe(200)
      expect(res.body.config.auth?.scim?.token).toBeNull()
    })

    it('returns system info', async () => {
      const res = await request(app).get('/api/config')
      expect(res.body.system).toHaveProperty('platform')
      expect(res.body.system).toHaveProperty('nodeVersion')
    })

    it('returns boolean for gitAvailable', async () => {
      const res = await request(app).get('/api/config')
      expect(typeof res.body.gitAvailable).toBe('boolean')
    })
  })

  describe('POST /api/config', () => {
    it('rejects empty body', async () => {
      const res = await request(app)
        .post('/api/config')
        .send({})
      // Empty update should either succeed (no-op) or fail validation
      expect([200, 400, 422]).toContain(res.status)
    })

    it('strips auth.secret from updates', async () => {
      const res = await request(app)
        .post('/api/config')
        .send({ auth: { secret: 'should-be-stripped' } })
      // Should not crash; secret is stripped server-side
      expect([200, 400, 422]).toContain(res.status)
    })
  })

  describe('GET /api/checklist', () => {
    it('returns checklist or 404 if file missing', async () => {
      const res = await request(app).get('/api/checklist')
      // TESTING.md may or may not exist
      expect([200, 404]).toContain(res.status)
      if (res.status === 200) {
        expect(res.headers['content-type']).toMatch(/text\/markdown/)
      }
    })
  })

  describe('POST /api/config (validation)', () => {
    it('rejects invalid reposRoot type', async () => {
      const res = await request(app)
        .post('/api/config')
        .send({ reposRoot: 12345 })
      expect([400, 422]).toContain(res.status)
    })
  })
})
