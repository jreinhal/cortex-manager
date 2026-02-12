const express = require('express')
const { parseStackText } = require('../stack-profile-parser')

function createStackProfileRoutes({ auth }) {
  const router = express.Router()

  /**
   * POST /stack-profile/parse
   * Accepts { text: string } and returns classified stack profile tokens
   */
  router.post(
    '/stack-profile/parse',
    auth.requirePermission('config', 'read', 'viewer'),
    (req, res) => {
      const { text } = req.body || {}
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Request body must include a "text" string.',
        })
      }

      if (text.length > 100_000) {
        return res.status(400).json({
          success: false,
          error: 'Text exceeds maximum length of 100,000 characters.',
        })
      }

      const parsed = parseStackText(text)
      return res.json({ success: true, data: parsed })
    }
  )

  return router
}

module.exports = createStackProfileRoutes
