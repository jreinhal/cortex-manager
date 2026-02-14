const fs = require('fs')
const path = require('path')
const os = require('os')

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-config-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// Import config fresh each time to avoid cross-test state
function loadConfigModule() {
  return require('../config')
}

describe('getDefaultReposRoot', () => {
  it('returns a string path', () => {
    const config = loadConfigModule()
    const result = config.getDefaultReposRoot()
    expect(typeof result).toBe('string')
    expect(path.isAbsolute(result)).toBe(true)
  })

  it('includes reference-repos in the path', () => {
    const config = loadConfigModule()
    const result = config.getDefaultReposRoot()
    expect(result).toContain('reference-repos')
  })
})

describe('getDefaultOutputDir', () => {
  it('returns absolute path ending in spawned_agents', () => {
    const config = loadConfigModule()
    const result = config.getDefaultOutputDir()
    expect(path.isAbsolute(result)).toBe(true)
    expect(result).toContain('spawned_agents')
  })
})

describe('getDefaultModelDir', () => {
  it('returns absolute path', () => {
    const config = loadConfigModule()
    const result = config.getDefaultModelDir()
    expect(path.isAbsolute(result)).toBe(true)
  })
})

describe('getSystemInfo', () => {
  it('returns system information object', () => {
    const config = loadConfigModule()
    const info = config.getSystemInfo()

    expect(info).toHaveProperty('platform')
    expect(info).toHaveProperty('arch')
    expect(info).toHaveProperty('nodeVersion')
    expect(info).toHaveProperty('homeDir')
    expect(info).toHaveProperty('configPath')
    expect(info).toHaveProperty('cwd')
    expect(info.platform).toBe(process.platform)
  })
})

describe('ensureDir', () => {
  it('creates directory if it does not exist', () => {
    const config = loadConfigModule()
    const dirPath = path.join(tmpDir, 'new-dir')

    const created = config.ensureDir(dirPath)
    expect(created).toBe(true)
    expect(fs.existsSync(dirPath)).toBe(true)
  })

  it('returns false if directory already exists', () => {
    const config = loadConfigModule()
    const dirPath = path.join(tmpDir, 'existing-dir')
    fs.mkdirSync(dirPath)

    const created = config.ensureDir(dirPath)
    expect(created).toBe(false)
  })

  it('creates nested directories recursively', () => {
    const config = loadConfigModule()
    const dirPath = path.join(tmpDir, 'a', 'b', 'c')

    config.ensureDir(dirPath)
    expect(fs.existsSync(dirPath)).toBe(true)
  })
})

describe('createDirectoryStructure', () => {
  it('creates all standard category directories', () => {
    const config = loadConfigModule()
    const reposRoot = path.join(tmpDir, 'repos')
    fs.mkdirSync(reposRoot)

    const created = config.createDirectoryStructure(reposRoot)

    expect(fs.existsSync(path.join(reposRoot, 'agents'))).toBe(true)
    expect(fs.existsSync(path.join(reposRoot, 'skills'))).toBe(true)
    expect(fs.existsSync(path.join(reposRoot, 'knowledge'))).toBe(true)
    expect(fs.existsSync(path.join(reposRoot, 'tools'))).toBe(true)
    expect(fs.existsSync(path.join(reposRoot, 'benchmarks'))).toBe(true)
    expect(fs.existsSync(path.join(reposRoot, '_system'))).toBe(true)
    expect(created.length).toBeGreaterThan(0)
  })

  it('creates repos.json registry file', () => {
    const config = loadConfigModule()
    const reposRoot = path.join(tmpDir, 'repos2')
    fs.mkdirSync(reposRoot)

    config.createDirectoryStructure(reposRoot)

    const registryPath = path.join(reposRoot, '_system', 'repos.json')
    expect(fs.existsSync(registryPath)).toBe(true)

    const content = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    expect(content).toEqual([])
  })

  it('does not recreate existing directories', () => {
    const config = loadConfigModule()
    const reposRoot = path.join(tmpDir, 'repos3')
    fs.mkdirSync(reposRoot)
    fs.mkdirSync(path.join(reposRoot, 'agents'))

    const created = config.createDirectoryStructure(reposRoot)
    expect(created).not.toContain('agents')
  })
})

describe('validateReposRoot', () => {
  it('validates an absolute path that exists', () => {
    const config = loadConfigModule()
    const reposRoot = path.join(tmpDir, 'valid-root')
    fs.mkdirSync(reposRoot)

    const result = config.validateReposRoot(reposRoot)
    expect(result.valid).toBe(true)
    expect(result.exists).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects relative paths', () => {
    const config = loadConfigModule()
    const result = config.validateReposRoot('relative/path')

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Path must be absolute')
  })

  it('detects when path has structure', () => {
    const config = loadConfigModule()
    const reposRoot = path.join(tmpDir, 'structured')
    fs.mkdirSync(reposRoot)
    fs.mkdirSync(path.join(reposRoot, '_system'), { recursive: true })
    fs.writeFileSync(path.join(reposRoot, '_system', 'repos.json'), '[]')

    const result = config.validateReposRoot(reposRoot)
    expect(result.hasStructure).toBe(true)
  })

  it('detects when path lacks structure', () => {
    const config = loadConfigModule()
    const reposRoot = path.join(tmpDir, 'empty')
    fs.mkdirSync(reposRoot)

    const result = config.validateReposRoot(reposRoot)
    expect(result.hasStructure).toBe(false)
  })

  it('reports warnings for missing parent in non-strict mode', () => {
    const config = loadConfigModule()
    const result = config.validateReposRoot(
      path.join(tmpDir, 'nonexistent-parent', 'child', 'repos')
    )

    expect(result.valid).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('reports errors for missing parent in strict mode', () => {
    const config = loadConfigModule()
    const result = config.validateReposRoot(
      path.join(tmpDir, 'nonexistent-parent', 'child', 'repos'),
      { strict: true }
    )

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('saved prompts', () => {
  it('savePrompt creates a new prompt and getSavedPrompts retrieves it', () => {
    const config = loadConfigModule()
    const saved = config.savePrompt('Test Title', 'Test query')

    expect(saved).toHaveProperty('id')
    expect(saved.title).toBe('Test Title')
    expect(saved.query).toBe('Test query')
    expect(saved).toHaveProperty('createdAt')

    const all = config.getSavedPrompts()
    expect(all.some((p) => p.id === saved.id)).toBe(true)
  })

  it('updatePrompt modifies an existing prompt', () => {
    const config = loadConfigModule()
    const saved = config.savePrompt('Original', 'original query')

    const updated = config.updatePrompt(saved.id, { title: 'Updated' })
    expect(updated.title).toBe('Updated')
    expect(updated.query).toBe('original query')
    expect(updated).toHaveProperty('updatedAt')
  })

  it('updatePrompt returns null for nonexistent id', () => {
    const config = loadConfigModule()
    const result = config.updatePrompt('nonexistent-id', { title: 'Nope' })
    expect(result).toBeNull()
  })

  it('deletePrompt removes a prompt', () => {
    const config = loadConfigModule()
    const saved = config.savePrompt('To Delete', 'query')

    const deleted = config.deletePrompt(saved.id)
    expect(deleted).toBe(true)

    const all = config.getSavedPrompts()
    expect(all.some((p) => p.id === saved.id)).toBe(false)
  })

  it('deletePrompt returns false for nonexistent id', () => {
    const config = loadConfigModule()
    const result = config.deletePrompt('nonexistent-id')
    expect(result).toBe(false)
  })
})

describe('getAnalytics', () => {
  it('returns analytics structure with correct fields', () => {
    const config = loadConfigModule()
    const analytics = config.getAnalytics()

    expect(analytics).toHaveProperty('totalSpawns')
    expect(analytics).toHaveProperty('thisMonthSpawns')
    expect(analytics).toHaveProperty('topAgent')
    expect(analytics).toHaveProperty('avgResourcesPerSpawn')
    expect(analytics).toHaveProperty('recentSpawns')
    expect(typeof analytics.totalSpawns).toBe('number')
  })
})

describe('recordSpawn', () => {
  it('records a spawn event to analytics', () => {
    const config = loadConfigModule()
    const beforeCount = config.getAnalytics().totalSpawns

    config.recordSpawn('test goal', 'claude', 5)

    const afterAnalytics = config.getAnalytics()
    const expectedCount = Math.min(beforeCount + 1, 100)
    expect(afterAnalytics.totalSpawns).toBe(expectedCount)
    expect(afterAnalytics.recentSpawns[0]?.goal).toContain('test goal')
  })

  it('truncates long goals', () => {
    const config = loadConfigModule()
    const longGoal = 'a'.repeat(200)
    config.recordSpawn(longGoal, 'test-agent', 1)

    const analytics = config.getAnalytics()
    const recent = analytics.recentSpawns[0]
    expect(recent.goal.length).toBeLessThanOrEqual(100)
  })
})
