const fs = require('fs')
const path = require('path')
const os = require('os')

// We need to access analyzeRepoContent which is exported
// We also need to mock getConfig for functions that use it
const repoManager = require('../repo-manager')

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-repo-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('isGitAvailable', () => {
  it('returns a boolean', () => {
    const result = repoManager.isGitAvailable()
    expect(typeof result).toBe('boolean')
  })

  it('returns true when git is installed', () => {
    // git should be available in CI and dev environments
    expect(repoManager.isGitAvailable()).toBe(true)
  })
})

describe('analyzeRepoContent', () => {
  it('returns default category "knowledge" for empty directory', () => {
    const repoPath = path.join(tmpDir, 'empty-repo')
    fs.mkdirSync(repoPath)

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result).toHaveProperty('category')
    expect(result).toHaveProperty('scores')
    expect(result).toHaveProperty('confidence')
    expect(result.category).toBe('knowledge')
    expect(result.confidence).toBe('low')
  })

  it('detects agent repos from agent.config.json', () => {
    const repoPath = path.join(tmpDir, 'agent-repo')
    fs.mkdirSync(repoPath)
    fs.writeFileSync(path.join(repoPath, 'agent.config.json'), '{}')

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.category).toBe('agents')
    expect(result.confidence).toBe('high')
  })

  it('detects tool repos from Dockerfile + setup.py', () => {
    const repoPath = path.join(tmpDir, 'tool-repo')
    fs.mkdirSync(repoPath)
    fs.writeFileSync(path.join(repoPath, 'Dockerfile'), 'FROM node:20')
    fs.writeFileSync(path.join(repoPath, 'setup.py'), '')
    fs.writeFileSync(path.join(repoPath, '.env.example'), '')
    fs.mkdirSync(path.join(repoPath, 'src'))

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.category).toBe('tools')
  })

  it('detects benchmark repos from evals directory', () => {
    const repoPath = path.join(tmpDir, 'bench-repo')
    fs.mkdirSync(repoPath)
    fs.mkdirSync(path.join(repoPath, 'evals'))
    fs.mkdirSync(path.join(repoPath, 'tests'))

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.category).toBe('benchmarks')
  })

  it('detects knowledge repos from awesome- prefix', () => {
    const repoPath = path.join(tmpDir, 'awesome-llms')
    fs.mkdirSync(repoPath)

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.category).toBe('knowledge')
    expect(result.confidence).toBe('high')
  })

  it('detects skills repos from prompts directory and template', () => {
    const repoPath = path.join(tmpDir, 'skill-repo')
    fs.mkdirSync(repoPath)
    fs.mkdirSync(path.join(repoPath, 'prompts'))
    fs.writeFileSync(path.join(repoPath, 'template.md'), '# Template')

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.category).toBe('skills')
  })

  it('uses README keywords for scoring', () => {
    const repoPath = path.join(tmpDir, 'readme-repo')
    fs.mkdirSync(repoPath)
    fs.writeFileSync(
      path.join(repoPath, 'README.md'),
      '# MCP Server\nThis is an mcp server for doing things with a cli tool.'
    )

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.category).toBe('tools')
  })

  it('uses repo name heuristics', () => {
    const repoPath = path.join(tmpDir, 'my-benchmark-suite')
    fs.mkdirSync(repoPath)

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(result.scores.benchmarks).toBeGreaterThan(0)
  })

  it('returns all five category scores', () => {
    const repoPath = path.join(tmpDir, 'any-repo')
    fs.mkdirSync(repoPath)

    const result = repoManager.analyzeRepoContent(repoPath)
    expect(Object.keys(result.scores)).toEqual(
      expect.arrayContaining(['agents', 'skills', 'knowledge', 'tools', 'benchmarks'])
    )
  })
})

describe('getCategories', () => {
  it('returns the standard category list', () => {
    const categories = repoManager.getCategories()
    expect(categories).toContain('agents')
    expect(categories).toContain('skills')
    expect(categories).toContain('knowledge')
    expect(categories).toContain('tools')
    expect(categories).toContain('benchmarks')
  })
})

describe('loadRegistry', () => {
  it('returns empty array when registry does not exist', () => {
    const result = repoManager.loadRegistry(path.join(tmpDir, 'nonexistent'))
    expect(result).toEqual([])
  })

  it('loads repos from registry file', () => {
    const reposRoot = path.join(tmpDir, 'repos')
    const systemDir = path.join(reposRoot, '_system')
    fs.mkdirSync(systemDir, { recursive: true })

    const repos = [
      { Name: 'repo1', Path: '/path/to/repo1', Category: 'agents' },
      { Name: 'repo2', Path: '/path/to/repo2', Category: 'tools' },
    ]
    fs.writeFileSync(path.join(systemDir, 'repos.json'), JSON.stringify(repos))

    const result = repoManager.loadRegistry(reposRoot)
    expect(result).toEqual(repos)
  })

  it('handles BOM in registry file', () => {
    const reposRoot = path.join(tmpDir, 'bom-repos')
    const systemDir = path.join(reposRoot, '_system')
    fs.mkdirSync(systemDir, { recursive: true })

    const repos = [{ Name: 'test' }]
    // Write with BOM prefix
    fs.writeFileSync(
      path.join(systemDir, 'repos.json'),
      '\uFEFF' + JSON.stringify(repos)
    )

    const result = repoManager.loadRegistry(reposRoot)
    expect(result).toEqual(repos)
  })
})

describe('saveRegistry', () => {
  it('saves repos to registry file', () => {
    const reposRoot = path.join(tmpDir, 'save-repos')
    fs.mkdirSync(reposRoot)

    const repos = [{ Name: 'saved', Category: 'skills' }]
    repoManager.saveRegistry(repos, reposRoot)

    const registryPath = path.join(reposRoot, '_system', 'repos.json')
    expect(fs.existsSync(registryPath)).toBe(true)

    const loaded = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    expect(loaded).toEqual(repos)
  })

  it('creates _system directory if needed', () => {
    const reposRoot = path.join(tmpDir, 'new-root')
    fs.mkdirSync(reposRoot)

    repoManager.saveRegistry([], reposRoot)

    expect(fs.existsSync(path.join(reposRoot, '_system'))).toBe(true)
  })
})
