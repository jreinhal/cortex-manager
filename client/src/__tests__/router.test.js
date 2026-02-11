import { describe, it, expect } from 'vitest'
import {
  VIEW_ROUTES,
  VIEW_PATHS,
  VIEW_KEYS,
  VIEW_ALIASES,
  resolveViewFromPath,
  resolveViewFromQuery,
} from '../router'

describe('router', () => {
  describe('VIEW_ROUTES', () => {
    it('maps / to home', () => {
      expect(VIEW_ROUTES['/']).toBe('home')
    })

    it('maps all VIEW_KEYS to paths', () => {
      const routeValues = Object.values(VIEW_ROUTES)
      for (const key of VIEW_KEYS) {
        expect(routeValues).toContain(key)
      }
    })
  })

  describe('VIEW_PATHS', () => {
    it('is the inverse of VIEW_ROUTES', () => {
      for (const [path, key] of Object.entries(VIEW_ROUTES)) {
        expect(VIEW_PATHS[key]).toBe(path)
      }
    })

    it('home maps to /', () => {
      expect(VIEW_PATHS.home).toBe('/')
    })

    it('agents maps to /agents', () => {
      expect(VIEW_PATHS.agents).toBe('/agents')
    })
  })

  describe('VIEW_KEYS', () => {
    it('has 10 entries', () => {
      expect(VIEW_KEYS).toHaveLength(10)
    })

    it('starts with home', () => {
      expect(VIEW_KEYS[0]).toBe('home')
    })

    it('ends with settings', () => {
      expect(VIEW_KEYS[VIEW_KEYS.length - 1]).toBe('settings')
    })
  })

  describe('resolveViewFromPath', () => {
    it('returns home for /', () => {
      expect(resolveViewFromPath('/')).toBe('home')
    })

    it('returns agents for /agents', () => {
      expect(resolveViewFromPath('/agents')).toBe('agents')
    })

    it('returns knowledge for /knowledge', () => {
      expect(resolveViewFromPath('/knowledge')).toBe('knowledge')
    })

    it('returns home for unknown paths', () => {
      expect(resolveViewFromPath('/unknown')).toBe('home')
    })

    it('returns home for empty string', () => {
      expect(resolveViewFromPath('')).toBe('home')
    })
  })

  describe('resolveViewFromQuery', () => {
    it('returns null for null input', () => {
      expect(resolveViewFromQuery(null)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(resolveViewFromQuery('')).toBeNull()
    })

    it('resolves valid view keys', () => {
      expect(resolveViewFromQuery('agents')).toBe('agents')
      expect(resolveViewFromQuery('knowledge')).toBe('knowledge')
      expect(resolveViewFromQuery('settings')).toBe('settings')
    })

    it('resolves aliases', () => {
      expect(resolveViewFromQuery('dashboard')).toBe('home')
      expect(resolveViewFromQuery('repos')).toBe('knowledge')
      expect(resolveViewFromQuery('repositories')).toBe('knowledge')
    })

    it('returns null for unknown views', () => {
      expect(resolveViewFromQuery('nonexistent')).toBeNull()
    })
  })

  describe('VIEW_ALIASES', () => {
    it('maps dashboard to home', () => {
      expect(VIEW_ALIASES.dashboard).toBe('home')
    })

    it('maps repos to knowledge', () => {
      expect(VIEW_ALIASES.repos).toBe('knowledge')
    })
  })
})
