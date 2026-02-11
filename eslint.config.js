const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
  {
    ignores: ['client/**', 'node_modules/**', 'test-results/**', 'spawned_agents/**']
  },
  {
    files: ['**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  }
]
