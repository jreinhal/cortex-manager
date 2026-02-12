import { describe, it, expect } from 'vitest'

const { parseStackText } = require('../stack-profile-parser')

describe('parseStackText', () => {
  it('returns empty arrays for empty input', () => {
    const result = parseStackText('')
    expect(result).toEqual({
      languages: [],
      frameworks: [],
      tools: [],
      platforms: [],
      tags: [],
    })
  })

  it('returns empty arrays for null/undefined input', () => {
    expect(parseStackText(null)).toEqual({
      languages: [],
      frameworks: [],
      tools: [],
      platforms: [],
      tags: [],
    })
    expect(parseStackText(undefined)).toEqual({
      languages: [],
      frameworks: [],
      tools: [],
      platforms: [],
      tags: [],
    })
  })

  it('detects languages', () => {
    const result = parseStackText('We use TypeScript and Python for our backend')
    expect(result.languages).toContain('typescript')
    expect(result.languages).toContain('python')
  })

  it('detects frameworks', () => {
    const result = parseStackText('React 19, Express 5, Tailwind CSS')
    expect(result.frameworks).toContain('react')
    expect(result.frameworks).toContain('express')
    expect(result.frameworks).toContain('tailwind')
  })

  it('detects tools', () => {
    const result = parseStackText('ESLint 9, Prettier, Vite 7, Zod')
    expect(result.tools).toContain('eslint')
    expect(result.tools).toContain('prettier')
    expect(result.tools).toContain('vite')
    expect(result.tools).toContain('zod')
  })

  it('detects platforms', () => {
    const result = parseStackText('Frontend web app with backend API')
    expect(result.platforms).toContain('web')
    expect(result.platforms).toContain('api')
  })

  it('detects tags', () => {
    const result = parseStackText('CI/CD pipeline, TDD, real-time WebSocket')
    expect(result.tags).toContain('ci')
    expect(result.tags).toContain('testing')
    expect(result.tags).toContain('real-time')
  })

  it('handles CORTEX tech stack description', () => {
    const text = [
      'Frontend: React 19, Vite 7, Tailwind CSS 4, Framer Motion',
      'Backend: Node.js 25, Express 5',
      'Module System: CommonJS, ESM',
      'Validation: Zod',
      'Testing: Vitest 4',
      'Linting: ESLint 9, Prettier',
      'Storage: JSON flat files (no database)',
      'Icons: Lucide React',
      'Deployment: Local-first (localhost)',
    ].join('\n')

    const result = parseStackText(text)
    expect(result.languages).toContain('javascript')
    expect(result.frameworks).toContain('react')
    expect(result.frameworks).toContain('express')
    expect(result.frameworks).toContain('tailwind')
    expect(result.frameworks).toContain('framer-motion')
    expect(result.frameworks).toContain('vitest')
    expect(result.tools).toContain('vite')
    expect(result.tools).toContain('eslint')
    expect(result.tools).toContain('prettier')
    expect(result.tools).toContain('zod')
    expect(result.tools).toContain('lucide-react')
    expect(result.platforms).toContain('local-first')
    expect(result.tags).toContain('commonjs')
    expect(result.tags).toContain('esm')
    expect(result.tags).toContain('flat-file')
  })

  it('is case-insensitive', () => {
    const result = parseStackText('REACT, TYPESCRIPT, DOCKER')
    expect(result.frameworks).toContain('react')
    expect(result.languages).toContain('typescript')
    expect(result.tools).toContain('docker')
  })

  it('handles multi-word terms', () => {
    const result = parseStackText('We use React Native and Spring Boot')
    expect(result.platforms).toContain('mobile')
    expect(result.frameworks).toContain('spring')
  })

  it('returns sorted arrays', () => {
    const result = parseStackText('Python, TypeScript, JavaScript, Go')
    const sorted = [...result.languages].sort()
    expect(result.languages).toEqual(sorted)
  })

  it('does not produce duplicates', () => {
    const result = parseStackText('React React React React')
    expect(result.frameworks.filter((f) => f === 'react')).toHaveLength(1)
  })
})
