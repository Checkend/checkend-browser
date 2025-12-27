import { describe, it, expect, beforeEach } from 'vitest'
import { Configuration } from '../src/configuration'

describe('Configuration', () => {
  describe('constructor', () => {
    it('sets required apiKey', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      expect(config.apiKey).toBe('test-key')
    })

    it('uses default endpoint', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      expect(config.endpoint).toBe('https://app.checkend.io')
    })

    it('allows custom endpoint', () => {
      const config = new Configuration({
        apiKey: 'test-key',
        endpoint: 'https://custom.example.com',
      })
      expect(config.endpoint).toBe('https://custom.example.com')
    })

    it('sets default filter keys', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      expect(config.filterKeys).toContain('password')
      expect(config.filterKeys).toContain('token')
      expect(config.filterKeys).toContain('authorization')
    })

    it('merges custom filter keys', () => {
      const config = new Configuration({
        apiKey: 'test-key',
        filterKeys: ['customSecret'],
      })
      expect(config.filterKeys).toContain('password')
      expect(config.filterKeys).toContain('customSecret')
    })
  })

  describe('isValid', () => {
    it('returns true when apiKey and endpoint are set', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      expect(config.isValid()).toBe(true)
    })

    it('returns false when apiKey is empty', () => {
      const config = new Configuration({ apiKey: '' })
      expect(config.isValid()).toBe(false)
    })
  })

  describe('enabled', () => {
    it('respects explicit enabled setting', () => {
      const config = new Configuration({ apiKey: 'test-key', enabled: false })
      expect(config.enabled).toBe(false)
    })

    it('can be set after construction', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      config.enabled = true
      expect(config.enabled).toBe(true)
    })
  })

  describe('shouldIgnore', () => {
    it('ignores errors matching string pattern', () => {
      const config = new Configuration({
        apiKey: 'test-key',
        ignoredExceptions: ['CustomError'],
      })
      expect(config.shouldIgnore('CustomError', 'some message')).toBe(true)
      expect(config.shouldIgnore('OtherError', 'some message')).toBe(false)
    })

    it('ignores errors matching regex pattern', () => {
      const config = new Configuration({
        apiKey: 'test-key',
        ignoredExceptions: [/^Network/],
      })
      expect(config.shouldIgnore('NetworkError', 'failed')).toBe(true)
      expect(config.shouldIgnore('OtherError', 'failed')).toBe(false)
    })

    it('ignores messages matching pattern', () => {
      const config = new Configuration({
        apiKey: 'test-key',
        ignoredExceptions: ['Script error.'],
      })
      expect(config.shouldIgnore('Error', 'Script error.')).toBe(true)
    })

    it('includes default ignored exceptions', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      expect(config.shouldIgnore('Error', 'ResizeObserver loop limit exceeded')).toBe(true)
    })
  })

  describe('ingestUrl', () => {
    it('builds correct ingest URL', () => {
      const config = new Configuration({ apiKey: 'test-key' })
      expect(config.ingestUrl).toBe('https://app.checkend.io/ingest/v1/errors')
    })

    it('uses custom endpoint', () => {
      const config = new Configuration({
        apiKey: 'test-key',
        endpoint: 'https://custom.example.com',
      })
      expect(config.ingestUrl).toBe('https://custom.example.com/ingest/v1/errors')
    })
  })
})
