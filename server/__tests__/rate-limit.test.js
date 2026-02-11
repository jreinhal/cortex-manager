const { apiLimiter, writeLimiter, authLimiter } = require('../middleware/rate-limit')

describe('rate-limit middleware', () => {
  it('exports apiLimiter as a function', () => {
    expect(typeof apiLimiter).toBe('function')
  })

  it('exports writeLimiter as a function', () => {
    expect(typeof writeLimiter).toBe('function')
  })

  it('exports authLimiter as a function', () => {
    expect(typeof authLimiter).toBe('function')
  })

  it('all limiters are distinct instances', () => {
    expect(apiLimiter).not.toBe(writeLimiter)
    expect(apiLimiter).not.toBe(authLimiter)
    expect(writeLimiter).not.toBe(authLimiter)
  })
})
