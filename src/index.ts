import { Configuration } from './configuration'
import { Client } from './client'
import { SanitizeFilter } from './filters/sanitize'
import { createNotice, createNoticeFromRaw } from './notice'
import type {
  ConfigOptions,
  Notice,
  NotifyOptions,
  Context,
  User,
  RequestInfo,
  ApiResponse,
} from './types'

export type {
  ConfigOptions,
  Notice,
  NotifyOptions,
  Context,
  User,
  RequestInfo,
  ApiResponse,
  BeforeNotifyCallback,
} from './types'

export { VERSION } from './version'

// Global state
let config: Configuration | null = null
let client: Client | null = null
let sanitizeFilter: SanitizeFilter | null = null
let started = false
let globalContext: Context = {}
let globalUser: User = {}
let originalOnError: OnErrorEventHandler | null = null
let originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null

/**
 * Configure the Checkend Browser SDK
 */
export function configure(options: ConfigOptions): void {
  config = new Configuration(options)

  if (!config.isValid()) {
    console.warn('[Checkend] Invalid configuration: apiKey is required')
    return
  }

  client = new Client(config)
  sanitizeFilter = new SanitizeFilter(config.filterKeys)

  start()
}

/**
 * Start the SDK (install error handlers)
 */
function start(): void {
  if (started || !config) return

  started = true

  if (config.captureUnhandled) {
    installErrorHandler()
  }

  if (config.captureUnhandledRejections) {
    installRejectionHandler()
  }

  log(`Started (environment: ${config.environment})`)
}

/**
 * Stop the SDK and clean up
 */
export function stop(): void {
  if (!started) return

  uninstallErrorHandler()
  uninstallRejectionHandler()

  started = false
  log('Stopped')
}

/**
 * Reset all SDK state
 */
export function reset(): void {
  stop()
  config = null
  client = null
  sanitizeFilter = null
  globalContext = {}
  globalUser = {}
}

// ========== Primary API ==========

/**
 * Report an error to Checkend
 */
export function notify(error: Error, options: NotifyOptions = {}): void {
  if (!shouldNotify()) return

  const errorClass = error.name || 'Error'
  const message = error.message || 'Unknown error'

  if (config!.shouldIgnore(errorClass, message)) {
    log(`Ignoring error: ${errorClass}`)
    return
  }

  const mergedContext = sanitize({ ...globalContext, ...options.context })
  const mergedUser = sanitize({ ...globalUser, ...options.user })
  const request = sanitize(options.request ?? captureRequestInfo())

  const notice = createNotice(error, {
    context: mergedContext,
    request,
    user: mergedUser,
    fingerprint: options.fingerprint,
    tags: options.tags,
    environment: config!.environment,
  })

  if (!runBeforeNotifyCallbacks(notice)) {
    return
  }

  client!.queueNotice(notice)
}

/**
 * Report an error synchronously (returns promise)
 */
export async function notifySync(error: Error, options: NotifyOptions = {}): Promise<ApiResponse | null> {
  if (!shouldNotify()) return null

  const mergedContext = sanitize({ ...globalContext, ...options.context })
  const mergedUser = sanitize({ ...globalUser, ...options.user })
  const request = sanitize(options.request ?? captureRequestInfo())

  const notice = createNotice(error, {
    context: mergedContext,
    request,
    user: mergedUser,
    fingerprint: options.fingerprint,
    tags: options.tags,
    environment: config!.environment,
  })

  if (!runBeforeNotifyCallbacks(notice)) {
    return null
  }

  return client!.sendNotice(notice)
}

/**
 * Flush all pending notices
 */
export async function flush(): Promise<void> {
  if (client) {
    await client.flush()
  }
}

// ========== Context Management ==========

/**
 * Set context data that will be included with all errors
 */
export function setContext(context: Context): void {
  globalContext = { ...globalContext, ...context }
}

/**
 * Set user information for error tracking
 */
export function setUser(user: User): void {
  globalUser = { ...globalUser, ...user }
}

/**
 * Get the current context
 */
export function getContext(): Context {
  return { ...globalContext }
}

/**
 * Get the current user
 */
export function getUser(): User {
  return { ...globalUser }
}

/**
 * Clear all context and user data
 */
export function clear(): void {
  globalContext = {}
  globalUser = {}
}

// ========== Error Handlers ==========

function installErrorHandler(): void {
  if (typeof window === 'undefined') return

  originalOnError = window.onerror

  window.onerror = function (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean {
    const messageStr = typeof message === 'string' ? message : message.toString()

    handleUnhandledError(messageStr, source, lineno, colno, error)

    // Call original handler if it exists
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error) as boolean
    }

    return false
  }
}

function uninstallErrorHandler(): void {
  if (typeof window === 'undefined') return

  if (originalOnError !== null) {
    window.onerror = originalOnError
    originalOnError = null
  }
}

function installRejectionHandler(): void {
  if (typeof window === 'undefined') return

  originalOnUnhandledRejection = window.onunhandledrejection as ((event: PromiseRejectionEvent) => void) | null

  window.onunhandledrejection = function (event: PromiseRejectionEvent): void {
    handleUnhandledRejection(event)

    // Call original handler if it exists
    if (originalOnUnhandledRejection) {
      originalOnUnhandledRejection.call(window, event)
    }
  }
}

function uninstallRejectionHandler(): void {
  if (typeof window === 'undefined') return

  if (originalOnUnhandledRejection !== null) {
    window.onunhandledrejection = originalOnUnhandledRejection
    originalOnUnhandledRejection = null
  }
}

function handleUnhandledError(
  message: string,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
): void {
  if (!shouldNotify()) return

  if (config!.shouldIgnore(error?.name ?? 'Error', message)) {
    return
  }

  const request = sanitize(captureRequestInfo())
  const context = sanitize({ ...globalContext, unhandled: true })
  const user = sanitize(globalUser)

  const notice = createNoticeFromRaw(message, source, lineno, colno, error, {
    context,
    request,
    user,
    tags: ['unhandled'],
    environment: config!.environment,
  })

  if (!runBeforeNotifyCallbacks(notice)) {
    return
  }

  client!.queueNotice(notice)
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  if (!shouldNotify()) return

  let error: Error
  const reason = event.reason

  if (reason instanceof Error) {
    error = reason
  } else if (typeof reason === 'string') {
    error = new Error(reason)
    error.name = 'UnhandledRejection'
  } else {
    error = new Error('Unhandled Promise rejection')
    error.name = 'UnhandledRejection'
  }

  if (config!.shouldIgnore(error.name, error.message)) {
    return
  }

  const request = sanitize(captureRequestInfo())
  const context = sanitize({ ...globalContext, unhandled: true, rejection: true })
  const user = sanitize(globalUser)

  const notice = createNotice(error, {
    context,
    request,
    user,
    tags: ['unhandled', 'promise-rejection'],
    environment: config!.environment,
  })

  if (!runBeforeNotifyCallbacks(notice)) {
    return
  }

  client!.queueNotice(notice)
}

// ========== Helpers ==========

function shouldNotify(): boolean {
  if (!started || !config || !client) return false
  if (!config.isValid()) return false
  if (!config.enabled) return false
  return true
}

function runBeforeNotifyCallbacks(notice: Notice): boolean {
  if (!config) return true

  for (const callback of config.beforeNotify) {
    try {
      const result = callback(notice)
      if (result === false) {
        log('Notice blocked by beforeNotify callback')
        return false
      }
    } catch (e) {
      logWarn(`beforeNotify callback failed: ${e}`)
    }
  }

  return true
}

function sanitize<T>(data: T): T {
  if (!sanitizeFilter) return data
  return sanitizeFilter.sanitize(data)
}

function captureRequestInfo(): RequestInfo {
  if (typeof window === 'undefined') return {}

  return {
    url: window.location?.href,
    userAgent: navigator?.userAgent,
    referrer: document?.referrer,
    language: navigator?.language,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  }
}

function log(message: string): void {
  if (config?.debug) {
    console.log(`[Checkend] ${message}`)
  }
}

function logWarn(message: string): void {
  console.warn(`[Checkend] ${message}`)
}

// Default export for convenience
export default {
  configure,
  stop,
  reset,
  notify,
  notifySync,
  flush,
  setContext,
  setUser,
  getContext,
  getUser,
  clear,
}
