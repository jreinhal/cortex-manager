const request = require('supertest')

let app

beforeAll(() => {
  app = require('../../index')
})

describe('Stack Profile API', () => {
  describe('POST /api/stack-profile/parse', () => {
    it('parses text and returns categorized tokens', async () => {
      const res = await request(app)
        .post('/api/stack-profile/parse')
        .send({ text: 'React, TypeScript, Docker, Vite' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('languages')
      expect(res.body.data).toHaveProperty('frameworks')
      expect(res.body.data).toHaveProperty('tools')
      expect(res.body.data).toHaveProperty('platforms')
      expect(res.body.data).toHaveProperty('tags')
      expect(res.body.data.languages).toContain('typescript')
      expect(res.body.data.frameworks).toContain('react')
      expect(res.body.data.tools).toContain('docker')
      expect(res.body.data.tools).toContain('vite')
    })

    it('rejects missing text field', async () => {
      const res = await request(app)
        .post('/api/stack-profile/parse')
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBeTruthy()
    })

    it('rejects non-string text', async () => {
      const res = await request(app)
        .post('/api/stack-profile/parse')
        .send({ text: 42 })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('handles empty text string', async () => {
      const res = await request(app)
        .post('/api/stack-profile/parse')
        .send({ text: '' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns empty arrays for unrecognized text', async () => {
      const res = await request(app)
        .post('/api/stack-profile/parse')
        .send({ text: 'lorem ipsum dolor sit amet' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.languages).toHaveLength(0)
      expect(res.body.data.frameworks).toHaveLength(0)
      expect(res.body.data.tools).toHaveLength(0)
    })
  })
})
