const fs = require('fs')
const path = require('path')
const os = require('os')

const { readJsonFile, writeJsonAtomic, appendJsonLine } = require('../storage')

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-storage-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('readJsonFile', () => {
  it('returns fallback when file does not exist', () => {
    const result = readJsonFile(path.join(tmpDir, 'nonexistent.json'), { default: true })
    expect(result).toEqual({ default: true })
  })

  it('reads valid JSON from file', () => {
    const filePath = path.join(tmpDir, 'data.json')
    fs.writeFileSync(filePath, JSON.stringify({ name: 'test', count: 42 }), 'utf8')

    const result = readJsonFile(filePath, null)
    expect(result).toEqual({ name: 'test', count: 42 })
  })

  it('returns fallback for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json')
    fs.writeFileSync(filePath, 'not valid json {{{', 'utf8')

    const result = readJsonFile(filePath, [])
    expect(result).toEqual([])
  })

  it('reads arrays from JSON files', () => {
    const filePath = path.join(tmpDir, 'list.json')
    fs.writeFileSync(filePath, JSON.stringify([1, 2, 3]), 'utf8')

    const result = readJsonFile(filePath, [])
    expect(result).toEqual([1, 2, 3])
  })
})

describe('writeJsonAtomic', () => {
  it('writes JSON data to file', () => {
    const filePath = path.join(tmpDir, 'output.json')
    const data = { key: 'value', nested: { a: 1 } }

    const success = writeJsonAtomic(filePath, data)
    expect(success).toBe(true)

    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    expect(written).toEqual(data)
  })

  it('creates parent directories if needed', () => {
    const filePath = path.join(tmpDir, 'deep', 'nested', 'dir', 'output.json')

    const success = writeJsonAtomic(filePath, { created: true })
    expect(success).toBe(true)
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('overwrites existing file atomically', () => {
    const filePath = path.join(tmpDir, 'overwrite.json')
    writeJsonAtomic(filePath, { version: 1 })
    writeJsonAtomic(filePath, { version: 2 })

    const result = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    expect(result).toEqual({ version: 2 })
  })

  it('does not leave temp files on success', () => {
    const filePath = path.join(tmpDir, 'clean.json')
    writeJsonAtomic(filePath, { clean: true })

    const files = fs.readdirSync(tmpDir)
    expect(files).toEqual(['clean.json'])
  })
})

describe('appendJsonLine', () => {
  it('appends a JSON line to file', () => {
    const filePath = path.join(tmpDir, 'log.jsonl')

    appendJsonLine(filePath, { event: 'start' })
    appendJsonLine(filePath, { event: 'end' })

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.trim().split('\n').map(JSON.parse)
    expect(lines).toEqual([{ event: 'start' }, { event: 'end' }])
  })

  it('creates file if it does not exist', () => {
    const filePath = path.join(tmpDir, 'new.jsonl')
    appendJsonLine(filePath, { first: true })

    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('creates parent directories if needed', () => {
    const filePath = path.join(tmpDir, 'sub', 'dir', 'log.jsonl')
    appendJsonLine(filePath, { nested: true })

    expect(fs.existsSync(filePath)).toBe(true)
  })
})
