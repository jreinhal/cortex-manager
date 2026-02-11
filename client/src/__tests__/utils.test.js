import { cn, formatBytes, formatDuration } from '../lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('resolves tailwind conflicts', () => {
    const result = cn('p-4', 'p-2')
    expect(result).toBe('p-2')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('formatBytes', () => {
  it('returns 0 B for null', () => {
    expect(formatBytes(null)).toBe('0 B')
  })

  it('returns 0 B for undefined', () => {
    expect(formatBytes(undefined)).toBe('0 B')
  })

  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('formats megabytes with one decimal', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('formats gigabytes with one decimal', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB')
  })
})

describe('formatDuration', () => {
  it('returns dash for null', () => {
    expect(formatDuration(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(formatDuration(undefined)).toBe('—')
  })

  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500 ms')
  })

  it('formats seconds', () => {
    expect(formatDuration(3500)).toBe('3.5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s')
  })
})
