import type { ConfigOptions, BeforeNotifyCallback } from './types'

const DEFAULT_ENDPOINT = 'https://app.checkend.io'

const DEFAULT_FILTER_KEYS = [
  'password',
  'password_confirmation',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'authorization',
  'bearer',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'ssn',
]

const DEFAULT_IGNORED_EXCEPTIONS = [
  // Browser-specific errors that are often noise
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  /^Script error\.?$/,
]

/**
 * Configuration holds all settings for the Checkend Browser SDK.
 */
export class Configuration {
  apiKey: string
  endpoint: string
  environment: string
  private _enabled?: boolean
  timeout: number
  ignoredExceptions: (string | RegExp)[]
  filterKeys: string[]
  beforeNotify: BeforeNotifyCallback[]
  debug: boolean
  captureUnhandled: boolean
  captureUnhandledRejections: boolean
  maxQueueSize: number
  useSendBeacon: boolean

  constructor(options: ConfigOptions) {
    this.apiKey = options.apiKey
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT
    this.environment = options.environment ?? this.detectEnvironment()
    this._enabled = options.enabled
    this.timeout = options.timeout ?? 15000
    this.ignoredExceptions = [
      ...DEFAULT_IGNORED_EXCEPTIONS,
      ...(options.ignoredExceptions ?? []),
    ]
    this.filterKeys = [
      ...DEFAULT_FILTER_KEYS,
      ...(options.filterKeys ?? []),
    ]
    this.beforeNotify = options.beforeNotify ?? []
    this.debug = options.debug ?? false
    this.captureUnhandled = options.captureUnhandled ?? true
    this.captureUnhandledRejections = options.captureUnhandledRejections ?? true
    this.maxQueueSize = options.maxQueueSize ?? 100
    this.useSendBeacon = options.useSendBeacon ?? true
  }

  /**
   * Check if configuration is valid for sending errors
   */
  isValid(): boolean {
    return Boolean(this.apiKey && this.endpoint)
  }

  /**
   * Check if SDK is enabled
   */
  get enabled(): boolean {
    if (this._enabled !== undefined) {
      return this._enabled
    }
    return this.isProductionOrStaging()
  }

  set enabled(value: boolean) {
    this._enabled = value
  }

  /**
   * Check if an error should be ignored
   */
  shouldIgnore(errorClass: string, message: string): boolean {
    return this.ignoredExceptions.some((pattern) => {
      if (typeof pattern === 'string') {
        return errorClass === pattern || message === pattern
      }
      if (pattern instanceof RegExp) {
        return pattern.test(errorClass) || pattern.test(message)
      }
      return false
    })
  }

  /**
   * Get the ingest URL
   */
  get ingestUrl(): string {
    return `${this.endpoint}/ingest/v1/errors`
  }

  private detectEnvironment(): string {
    // Check for common environment indicators
    if (typeof window !== 'undefined') {
      const hostname = window.location?.hostname ?? ''

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development'
      }
      if (hostname.includes('staging') || hostname.includes('stage')) {
        return 'staging'
      }
    }

    return 'production'
  }

  private isProductionOrStaging(): boolean {
    return ['production', 'staging'].includes(this.environment)
  }
}
