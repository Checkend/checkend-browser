import { describe, it, expect } from 'vitest'
import { createNotice, createNoticeFromRaw, toPayload } from '../src/notice'

describe('createNotice', () => {
  it('creates notice from Error', () => {
    const error = new Error('Test error')
    error.name = 'TestError'

    const notice = createNotice(error)

    expect(notice.errorClass).toBe('TestError')
    expect(notice.message).toBe('Test error')
    expect(notice.backtrace).toBeInstanceOf(Array)
    expect(notice.occurredAt).toBeDefined()
  })

  it('includes context', () => {
    const error = new Error('Test error')
    const notice = createNotice(error, {
      context: { orderId: 123 },
    })

    expect(notice.context.orderId).toBe(123)
  })

  it('includes user', () => {
    const error = new Error('Test error')
    const notice = createNotice(error, {
      user: { id: 'user-1', email: 'test@example.com' },
    })

    expect(notice.user.id).toBe('user-1')
    expect(notice.user.email).toBe('test@example.com')
  })

  it('includes tags', () => {
    const error = new Error('Test error')
    const notice = createNotice(error, {
      tags: ['checkout', 'payment'],
    })

    expect(notice.tags).toEqual(['checkout', 'payment'])
  })

  it('includes fingerprint', () => {
    const error = new Error('Test error')
    const notice = createNotice(error, {
      fingerprint: 'custom-fingerprint',
    })

    expect(notice.fingerprint).toBe('custom-fingerprint')
  })

  it('includes environment', () => {
    const error = new Error('Test error')
    const notice = createNotice(error, {
      environment: 'production',
    })

    expect(notice.environment).toBe('production')
  })

  it('truncates long messages', () => {
    const longMessage = 'x'.repeat(15000)
    const error = new Error(longMessage)

    const notice = createNotice(error)

    expect(notice.message.length).toBeLessThan(longMessage.length)
    expect(notice.message).toContain('...')
  })

  it('handles empty error message', () => {
    const error = new Error()
    const notice = createNotice(error)

    expect(notice.message).toBe('Unknown error')
  })
})

describe('createNoticeFromRaw', () => {
  it('creates notice from raw error data', () => {
    const notice = createNoticeFromRaw(
      'Script error',
      'https://example.com/app.js',
      42,
      10
    )

    expect(notice.errorClass).toBe('Error')
    expect(notice.message).toBe('Script error')
    expect(notice.backtrace.length).toBeGreaterThan(0)
  })

  it('uses Error object if provided', () => {
    const error = new TypeError('Type mismatch')
    const notice = createNoticeFromRaw(
      'Type mismatch',
      'https://example.com/app.js',
      42,
      10,
      error
    )

    expect(notice.errorClass).toBe('TypeError')
  })
})

describe('toPayload', () => {
  it('converts notice to API payload format', () => {
    const error = new Error('Test error')
    const notice = createNotice(error, {
      context: { key: 'value' },
      user: { id: 'user-1' },
      tags: ['test'],
      environment: 'test',
    })

    const payload = toPayload(notice)

    expect(payload.error.class).toBe('Error')
    expect(payload.error.message).toBe('Test error')
    expect(payload.error.backtrace).toBeInstanceOf(Array)
    expect(payload.error.occurred_at).toBeDefined()
    expect(payload.error.tags).toEqual(['test'])
    expect(payload.context.key).toBe('value')
    expect(payload.context.environment).toBe('test')
    expect(payload.user.id).toBe('user-1')
    expect(payload.notifier.name).toBe('@checkend/browser')
    expect(payload.notifier.language).toBe('javascript')
  })

  it('omits tags if empty', () => {
    const error = new Error('Test error')
    const notice = createNotice(error)

    const payload = toPayload(notice)

    expect(payload.error.tags).toBeUndefined()
  })
})
