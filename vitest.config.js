const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/__tests__/**/*.test.js'],
    exclude: ['node_modules', 'client', 'tests/e2e'],
    testTimeout: 10000,
  },
})
