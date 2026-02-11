const request = require('supertest')

let app

beforeAll(() => {
  app = require('../../index')
})

describe('Auth API (auth disabled / local mode)', () => {
  describe('GET /api/auth/status', () => {
    it('returns auth status object', async () => {
      const res = await request(app).get('/api/auth/status')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('enabled')
      expect(res.body).toHaveProperty('roles')
      expect(Array.isArray(res.body.roles)).toBe(true)
      expect(res.body.roles).toContain('admin')
    })

    it('reports auth as disabled in local mode', async () => {
      const res = await request(app).get('/api/auth/status')
      expect(res.status).toBe(200)
      expect(res.body.enabled).toBe(false)
    })

    it('includes SSO and SCIM configuration', async () => {
      const res = await request(app).get('/api/auth/status')
      expect(res.body).toHaveProperty('sso')
      expect(res.body.sso).toHaveProperty('enabled')
      expect(res.body).toHaveProperty('scim')
      expect(res.body.scim).toHaveProperty('enabled')
    })

    it('includes RBAC configuration', async () => {
      const res = await request(app).get('/api/auth/status')
      expect(res.body).toHaveProperty('rbac')
      expect(res.body.rbac).toHaveProperty('enabled')
    })
  })

  describe('POST /api/auth/bootstrap', () => {
    it('rejects bootstrap when auth is disabled', async () => {
      const res = await request(app)
        .post('/api/auth/bootstrap')
        .send({ username: 'admin', password: 'password123' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/auth.*disabled/i)
    })
  })

  describe('POST /api/auth/login', () => {
    it('rejects login when auth is disabled', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/auth.*disabled/i)
    })

    it('validates request body schema', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '' })
      // Should fail Zod validation (missing password) or auth-disabled check
      expect([400, 422]).toContain(res.status)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns local user when auth is disabled', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('user')
      expect(res.body.user.username).toBe('local')
      expect(res.body.user.role).toBe('admin')
    })
  })
})
