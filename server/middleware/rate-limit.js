const rateLimit = require('express-rate-limit')

/**
 * General API rate limiter.
 * 1000 requests per minute per IP — generous for a local tool
 * that polls many endpoints concurrently (repos, categories, runs,
 * sessions, agents, tools, prompts, evaluations, datasets, jobs,
 * observability, vector status, workspaces, category-sizes).
 * Only guards against truly accidental runaway loops.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
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
