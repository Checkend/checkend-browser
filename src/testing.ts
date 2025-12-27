import type { Notice, ApiResponse } from './types'

/**
 * Testing utilities for Checkend Browser SDK.
 *
 * Use this module in your test suite to capture and inspect notices
 * without actually sending them to the server.
 *
 * @example
 * import * as Checkend from '@checkend/browser'
 * import { Testing } from '@checkend/browser/testing'
 *
 * beforeEach(() => {
 *   Testing.setup()
 *   Checkend.configure({ apiKey: 'test-key' })
 * })
 *
 * afterEach(() => {
 *   Testing.teardown()
 * })
 *
 * test('reports errors', () => {
 *   Checkend.notify(new Error('Test error'))
 *   expect(Testing.notices).toHaveLength(1)
 *   expect(Testing.lastNotice?.errorClass).toBe('Error')
 * })
 */

let notices: Notice[] = []
let originalFetch: typeof fetch | null = null
let originalSendBeacon: Navigator['sendBeacon'] | null = null
let isSetup = false

/**
 * Set up test mode - intercepts all SDK network calls
 */
export function setup(): void {
  if (isSetup) return

  isSetup = true
  notices = []

  // Mock fetch
  if (typeof globalThis.fetch !== 'undefined') {
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch
  }

  // Mock sendBeacon
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    originalSendBeacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = mockSendBeacon
  }
}

/**
 * Tear down test mode - restores original network functions
 */
export function teardown(): void {
  if (!isSetup) return

  isSetup = false

  // Restore fetch
  if (originalFetch) {
    globalThis.fetch = originalFetch
    originalFetch = null
  }

  // Restore sendBeacon
  if (typeof navigator !== 'undefined' && originalSendBeacon) {
    navigator.sendBeacon = originalSendBeacon
    originalSendBeacon = null
  }

  clearNotices()
}

/**
 * Get all captured notices
 */
export function getNotices(): Notice[] {
  return [...notices]
}

/**
 * Get the last captured notice
 */
export function getLastNotice(): Notice | undefined {
  return notices[notices.length - 1]
}

/**
 * Get the first captured notice
 */
export function getFirstNotice(): Notice | undefined {
  return notices[0]
}

/**
 * Clear all captured notices
 */
export function clearNotices(): void {
  notices = []
}

/**
 * Check if any notices were captured
 */
export function hasNotices(): boolean {
  return notices.length > 0
}

/**
 * Get the number of captured notices
 */
export function noticeCount(): number {
  return notices.length
}

// Mock implementations

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()

  // Check if this is a Checkend request
  if (url.includes('/ingest/v1/errors')) {
    const body = init?.body
    if (body) {
      try {
        const payload = JSON.parse(body.toString())
        captureFromPayload(payload)
      } catch {
        // Ignore parse errors
      }
    }

    // Return a fake successful response
    const response: ApiResponse = {
      id: notices.length,
      problem_id: notices.length,
    }

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Pass through non-Checkend requests
  if (originalFetch) {
    return originalFetch(input, init)
  }

  throw new Error('fetch not available')
}

function mockSendBeacon(url: string, data?: BodyInit | null): boolean {
  // Check if this is a Checkend request
  if (url.includes('/ingest/v1/errors')) {
    if (data) {
      try {
        let body: string
        if (data instanceof Blob) {
          // Can't read blob synchronously, so we'll skip capture here
          // In real tests, you should use fetch instead of sendBeacon
          return true
        } else if (typeof data === 'string') {
          body = data
        } else {
          body = data.toString()
        }
        const payload = JSON.parse(body)
        captureFromPayload(payload)
      } catch {
        // Ignore parse errors
      }
    }
    return true
  }

  // Pass through non-Checkend requests
  if (originalSendBeacon) {
    return originalSendBeacon(url, data)
  }

  return false
}

function captureFromPayload(payload: {
  error: {
    class: string
    message: string
    backtrace: string[]
    occurred_at: string
    fingerprint?: string
    tags?: string[]
  }
  context: Record<string, unknown>
  request: Record<string, unknown>
  user: Record<string, unknown>
}): void {
  const notice: Notice = {
    errorClass: payload.error.class,
    message: payload.error.message,
    backtrace: payload.error.backtrace,
    fingerprint: payload.error.fingerprint,
    tags: payload.error.tags ?? [],
    context: payload.context,
    request: payload.request,
    user: payload.user,
    environment: payload.context.environment as string | undefined,
    occurredAt: payload.error.occurred_at,
  }

  notices.push(notice)
}

// Export as named object for convenient import
export const Testing = {
  setup,
  teardown,
  get notices() {
    return getNotices()
  },
  get lastNotice() {
    return getLastNotice()
  },
  get firstNotice() {
    return getFirstNotice()
  },
  clearNotices,
  hasNotices,
  noticeCount,
}

export default Testing
