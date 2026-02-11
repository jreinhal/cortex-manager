const request = require('supertest')

let app

beforeAll(() => {
  app = require('../../index')
})

describe('Analytics API', () => {
  describe('GET /api/audit', () => {
    it('returns an array of audit entries', async () => {
      const res = await request(app).get('/api/audit')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('respects limit query parameter', async () => {
      const res = await request(app).get('/api/audit?limit=5')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeLessThanOrEqual(5)
    })

    it('filters by event type', async () => {
      const res = await request(app).get('/api/audit?event=config.update')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      // All returned entries should match the event filter (if any exist)
      for (const entry of res.body) {
        expect(entry.event).toBe('config.update')
      }
    })
  })

  describe('GET /api/audit/export', () => {
    it('exports audit log as JSON by default', async () => {
      const res = await request(app).get('/api/audit/export')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('entries')
      expect(Array.isArray(res.body.entries)).toBe(true)
      // Should set Content-Disposition header
      expect(res.headers['content-disposition']).toMatch(/attachment.*cortex-audit.*\.json/)
    })

    it('exports audit log as CSV when format=csv', async () => {
      const res = await request(app).get('/api/audit/export?format=csv')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/text\/csv/)
      expect(res.headers['content-disposition']).toMatch(/attachment.*cortex-audit.*\.csv/)
      // CSV should have header row
      const lines = res.text.split('\n')
      expect(lines[0]).toContain('timestamp')
      expect(lines[0]).toContain('event')
    })

    it('respects limit parameter on export', async () => {
      const res = await request(app).get('/api/audit/export?limit=3')
      expect(res.status).toBe(200)
      expect(res.body.entries.length).toBeLessThanOrEqual(3)
    })
  })

  describe('GET /api/logs', () => {
    it('returns an array of log entries', async () => {
      const res = await request(app).get('/api/logs')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('respects limit query parameter', async () => {
      const res = await request(app).get('/api/logs?limit=10')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeLessThanOrEqual(10)
    })
  })
})
