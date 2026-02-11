/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (coerced/defaulted) value.
 * On failure, returns 400 with structured error details.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (result.success) {
      req.body = result.data
      return next()
    }

    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    })
  }
}

/**
 * Validates req.query against a Zod schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query)
    if (result.success) {
      req.query = result.data
      return next()
    }

    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    })
  }
}

/**
 * Validates req.params against a Zod schema.
 */
function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params)
    if (result.success) {
      req.params = result.data
      return next()
    }

    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    })
  }
}

module.exports = { validate, validateQuery, validateParams }
