import type { Notice, Context, RequestInfo, User, NoticePayload, Notifier } from './types'
import { VERSION } from './version'

const MAX_BACKTRACE_LINES = 100
const MAX_MESSAGE_LENGTH = 10000

/**
 * Create a Notice from an Error object
 */
export function createNotice(
  error: Error,
  options: {
    context?: Context
    request?: RequestInfo
    user?: User
    fingerprint?: string
    tags?: string[]
    environment?: string
  } = {}
): Notice {
  return {
    errorClass: error.name || 'Error',
    message: truncateMessage(error.message || 'Unknown error'),
    backtrace: parseBacktrace(error.stack),
    fingerprint: options.fingerprint,
    tags: options.tags ?? [],
    context: options.context ?? {},
    request: options.request ?? {},
    user: options.user ?? {},
    environment: options.environment,
    occurredAt: new Date().toISOString(),
  }
}

/**
 * Create a Notice from raw error data (for window.onerror)
 */
export function createNoticeFromRaw(
  message: string,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error,
  options: {
    context?: Context
    request?: RequestInfo
    user?: User
    fingerprint?: string
    tags?: string[]
    environment?: string
  } = {}
): Notice {
  let backtrace: string[] = []
  let errorClass = 'Error'

  if (error) {
    backtrace = parseBacktrace(error.stack)
    errorClass = error.name || 'Error'
  } else if (source) {
    // Create a synthetic backtrace from the error location
    const location = `${source}:${lineno ?? 0}:${colno ?? 0}`
    backtrace = [location]
  }

  return {
    errorClass,
    message: truncateMessage(message),
    backtrace,
    fingerprint: options.fingerprint,
    tags: options.tags ?? [],
    context: options.context ?? {},
    request: options.request ?? {},
    user: options.user ?? {},
    environment: options.environment,
    occurredAt: new Date().toISOString(),
  }
}

/**
 * Convert a Notice to the API payload format
 */
export function toPayload(notice: Notice): NoticePayload {
  const notifier: Notifier = {
    name: '@checkend/browser',
    version: VERSION,
    language: 'javascript',
    language_version: getJsVersion(),
  }

  return {
    error: {
      class: notice.errorClass,
      message: notice.message,
      backtrace: notice.backtrace,
      occurred_at: notice.occurredAt,
      fingerprint: notice.fingerprint,
      tags: notice.tags.length > 0 ? notice.tags : undefined,
    },
    context: {
      ...notice.context,
      ...(notice.environment ? { environment: notice.environment } : {}),
    },
    request: notice.request,
    user: notice.user,
    notifier,
  }
}

/**
 * Parse a stack trace string into an array of frames
 */
function parseBacktrace(stack?: string): string[] {
  if (!stack) {
    return []
  }

  const lines = stack.split('\n')

  // Remove the first line if it's just the error message
  const frames = lines
    .filter((line) => {
      const trimmed = line.trim()
      // Keep lines that look like stack frames
      return trimmed.startsWith('at ') || /^\s*\w+@/.test(trimmed) || /^\s*@/.test(trimmed)
    })
    .map((line) => line.trim())
    .slice(0, MAX_BACKTRACE_LINES)

  // If no stack frames found, return the raw lines
  if (frames.length === 0) {
    return lines.slice(0, MAX_BACKTRACE_LINES).map((l) => l.trim()).filter(Boolean)
  }

  return frames
}

/**
 * Truncate message to max length
 */
function truncateMessage(message: string): string {
  if (!message) return ''
  if (message.length <= MAX_MESSAGE_LENGTH) return message
  return `${message.substring(0, MAX_MESSAGE_LENGTH - 3)}...`
}

/**
 * Get JavaScript engine version
 */
function getJsVersion(): string {
  // In browsers, we can't easily get the JS engine version
  // Return the user agent or a generic identifier
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    // Extract browser version from user agent
    const ua = navigator.userAgent
    const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/)
    if (match) {
      return `${match[1]}/${match[2]}`
    }
  }
  return 'unknown'
}
