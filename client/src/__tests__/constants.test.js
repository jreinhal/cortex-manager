import {
  SPRING_SMOOTH,
  SPRING_FAST,
  API_BASE,
  AUTH_TOKEN_KEY,
  WORKSPACE_KEY,
  THEME_KEY,
  FORMAT_OPTIONS,
  DEFAULT_FORMAT,
} from '../lib/constants'

describe('animation constants', () => {
  it('SPRING_SMOOTH is a tween config', () => {
    expect(SPRING_SMOOTH.type).toBe('tween')
    expect(SPRING_SMOOTH.duration).toBe(0.2)
    expect(SPRING_SMOOTH.ease).toHaveLength(4)
  })

  it('SPRING_FAST is a tween config', () => {
    expect(SPRING_FAST.type).toBe('tween')
    expect(SPRING_FAST.duration).toBe(0.16)
    expect(SPRING_FAST.ease).toHaveLength(4)
  })

  it('SPRING_FAST is faster than SPRING_SMOOTH', () => {
    expect(SPRING_FAST.duration).toBeLessThan(SPRING_SMOOTH.duration)
  })
})

describe('app constants', () => {
  it('API_BASE has a default value', () => {
    expect(typeof API_BASE).toBe('string')
    expect(API_BASE).toContain('localhost')
  })

  it('AUTH_TOKEN_KEY is a string', () => {
    expect(AUTH_TOKEN_KEY).toBe('cortex_token')
  })

  it('WORKSPACE_KEY is a string', () => {
    expect(WORKSPACE_KEY).toBe('cortex_workspace_id')
  })

  it('THEME_KEY is a string', () => {
    expect(THEME_KEY).toBe('cortex_theme')
  })
})

describe('FORMAT_OPTIONS', () => {
  it('has 4 format options', () => {
    expect(FORMAT_OPTIONS).toHaveLength(4)
  })

  it('each option has value, label, and accent', () => {
    for (const opt of FORMAT_OPTIONS) {
      expect(typeof opt.value).toBe('string')
      expect(typeof opt.label).toBe('string')
      expect(typeof opt.accent).toBe('string')
    }
  })

  it('DEFAULT_FORMAT matches first option', () => {
    expect(DEFAULT_FORMAT).toBe(FORMAT_OPTIONS[0].value)
    expect(DEFAULT_FORMAT).toBe('universal')
  })

  it('includes expected formats', () => {
    const values = FORMAT_OPTIONS.map((o) => o.value)
    expect(values).toContain('universal')
    expect(values).toContain('chatgpt')
    expect(values).toContain('claude')
    expect(values).toContain('gemini')
  })
})
