const { z } = require('zod')
const { validate, validateQuery, validateParams } = require('../middleware/validate')

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code
      return res
    },
    json(data) {
      res.body = data
      return res
    },
  }
  return res
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  })

  it('calls next() on valid body', () => {
    const req = { body: { name: 'Alice', age: 30 } }
    const res = createMockRes()
    let called = false
    const next = () => {
      called = true
    }

    validate(schema)(req, res, next)

    expect(called).toBe(true)
    expect(req.body).toEqual({ name: 'Alice', age: 30 })
  })

  it('replaces body with parsed data (coercion/defaults)', () => {
    const schemaWithDefault = z.object({
      name: z.string().min(1),
      role: z.string().optional().default('viewer'),
    })
    const req = { body: { name: 'Bob' } }
    const res = createMockRes()
    let called = false

    validate(schemaWithDefault)(req, res, () => {
      called = true
    })

    expect(called).toBe(true)
    expect(req.body.role).toBe('viewer')
  })

  it('returns 400 with details on invalid body', () => {
    const req = { body: { name: '', age: -5 } }
    const res = createMockRes()
    let called = false

    validate(schema)(req, res, () => {
      called = true
    })

    expect(called).toBe(false)
    expect(res.statusCode).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('Validation failed')
    expect(Array.isArray(res.body.details)).toBe(true)
    expect(res.body.details.length).toBeGreaterThan(0)
  })

  it('returns structured error details with path, message, and code', () => {
    const req = { body: {} }
    const res = createMockRes()

    validate(schema)(req, res, () => {})

    const detail = res.body.details[0]
    expect(detail).toHaveProperty('path')
    expect(detail).toHaveProperty('message')
    expect(detail).toHaveProperty('code')
  })

  it('returns 400 for missing required fields', () => {
    const req = { body: { age: 25 } }
    const res = createMockRes()

    validate(schema)(req, res, () => {})

    expect(res.statusCode).toBe(400)
    expect(res.body.details.some((d) => d.path === 'name')).toBe(true)
  })

  it('returns 400 for wrong types', () => {
    const req = { body: { name: 'Test', age: 'not-a-number' } }
    const res = createMockRes()

    validate(schema)(req, res, () => {})

    expect(res.statusCode).toBe(400)
    expect(res.body.details.some((d) => d.path === 'age')).toBe(true)
  })
})

describe('validateQuery middleware', () => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })

  it('calls next() on valid query', () => {
    const req = { query: { limit: '10', page: '1' } }
    const res = createMockRes()
    let called = false

    validateQuery(schema)(req, res, () => {
      called = true
    })

    expect(called).toBe(true)
    expect(req.query.limit).toBe(10)
  })

  it('returns 400 on invalid query', () => {
    const req = { query: { limit: '-1' } }
    const res = createMockRes()

    validateQuery(schema)(req, res, () => {})

    expect(res.statusCode).toBe(400)
  })
})

describe('validateParams middleware', () => {
  const schema = z.object({
    id: z.string().min(1),
  })

  it('calls next() on valid params', () => {
    const req = { params: { id: 'abc-123' } }
    const res = createMockRes()
    let called = false

    validateParams(schema)(req, res, () => {
      called = true
    })

    expect(called).toBe(true)
  })

  it('returns 400 on missing param', () => {
    const req = { params: {} }
    const res = createMockRes()

    validateParams(schema)(req, res, () => {})

    expect(res.statusCode).toBe(400)
  })
})
