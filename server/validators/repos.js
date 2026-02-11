const { z } = require('zod')

const addRepoSchema = z.object({
  url: z.string().min(1, 'URL is required').max(2000),
})

module.exports = { addRepoSchema }
