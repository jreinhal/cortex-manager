const rateLimit = require('express-rate-limit')

/**
 * General API rate limiter.
 * 100 requests per minute per IP — generous for a local tool,
 * but prevents accidental runaway loops.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
})

/**
 * Stricter limiter for write-heavy / expensive endpoints
 * (spawn, clone, scan, rebuild).
 * 10 requests per minute per IP.
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many write requests, please try again later.' },
})

/**
 * Auth endpoints limiter to slow brute-force attempts.
 * 20 requests per minute per IP.
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth requests, please try again later.' },
})

module.exports = { apiLimiter, writeLimiter, authLimiter }
