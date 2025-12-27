/**
 * User information for error tracking
 */
export interface User {
  id?: string | number
  email?: string
  name?: string
  [key: string]: unknown
}

/**
 * Request information captured with errors
 */
export interface RequestInfo {
  url?: string
  method?: string
  headers?: Record<string, string>
  [key: string]: unknown
}

/**
 * Context data attached to errors
 */
export type Context = Record<string, unknown>

/**
 * Notifier metadata sent with each error
 */
export interface Notifier {
  name: string
  version: string
  language: string
  language_version: string
}

/**
 * Error payload structure
 */
export interface ErrorPayload {
  class: string
  message: string
  backtrace: string[]
  occurred_at: string
  fingerprint?: string
  tags?: string[]
}

/**
 * Full notice payload sent to the API
 */
export interface NoticePayload {
  error: ErrorPayload
  context: Context
  request: RequestInfo
  user: User
  notifier: Notifier
}

/**
 * API response on successful error submission
 */
export interface ApiResponse {
  id: number
  problem_id: number
}

/**
 * Options for notify() calls
 */
export interface NotifyOptions {
  context?: Context
  request?: RequestInfo
  user?: User
  fingerprint?: string
  tags?: string[]
}

/**
 * Callback function called before sending a notice
 * Return false to prevent sending
 */
export type BeforeNotifyCallback = (notice: Notice) => boolean | void

/**
 * Configuration options for the Checkend SDK
 */
export interface ConfigOptions {
  /** Your Checkend ingestion API key (required) */
  apiKey: string
  /** Checkend server endpoint (default: https://app.checkend.io) */
  endpoint?: string
  /** Environment name (default: auto-detected) */
  environment?: string
  /** Enable/disable error reporting (default: true in production) */
  enabled?: boolean
  /** Request timeout in milliseconds (default: 15000) */
  timeout?: number
  /** Exception class names or patterns to ignore */
  ignoredExceptions?: (string | RegExp)[]
  /** Keys to filter from context/request data */
  filterKeys?: string[]
  /** Callbacks to run before sending (return false to skip) */
  beforeNotify?: BeforeNotifyCallback[]
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Capture unhandled errors (default: true) */
  captureUnhandled?: boolean
  /** Capture unhandled promise rejections (default: true) */
  captureUnhandledRejections?: boolean
  /** Maximum number of notices to queue (default: 100) */
  maxQueueSize?: number
  /** Use sendBeacon for sending (default: true) */
  useSendBeacon?: boolean
}

/**
 * Notice represents an error to be sent to Checkend
 */
export interface Notice {
  errorClass: string
  message: string
  backtrace: string[]
  fingerprint?: string
  tags: string[]
  context: Context
  request: RequestInfo
  user: User
  environment?: string
  occurredAt: string
}
