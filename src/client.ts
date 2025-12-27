import type { Configuration } from './configuration'
import type { Notice, ApiResponse, NoticePayload } from './types'
import { toPayload } from './notice'
import { VERSION } from './version'

const USER_AGENT = `@checkend/browser/${VERSION}`

/**
 * HTTP client for sending error notices to the Checkend API.
 */
export class Client {
  private config: Configuration
  private queue: NoticePayload[] = []
  private sending = false

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Send a notice to the Checkend API
   */
  async sendNotice(notice: Notice): Promise<ApiResponse | null> {
    const payload = toPayload(notice)

    // Try sendBeacon first for reliability (works even on page unload)
    if (this.config.useSendBeacon && this.trySendBeacon(payload)) {
      this.log('Notice sent via sendBeacon')
      return null // sendBeacon doesn't return response
    }

    // Fall back to fetch
    return this.sendViaFetch(payload)
  }

  /**
   * Queue a notice for sending (non-blocking)
   */
  queueNotice(notice: Notice): boolean {
    if (this.queue.length >= this.config.maxQueueSize) {
      this.log('Queue full, dropping notice')
      return false
    }

    const payload = toPayload(notice)
    this.queue.push(payload)
    this.processQueue()
    return true
  }

  /**
   * Flush all queued notices
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    if (this.sending || this.queue.length === 0) {
      return
    }

    this.sending = true

    while (this.queue.length > 0) {
      const payload = this.queue.shift()
      if (payload) {
        await this.sendViaFetch(payload)
      }
    }

    this.sending = false
  }

  private trySendBeacon(payload: NoticePayload): boolean {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return false
    }

    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      // Note: sendBeacon doesn't support custom headers
      // For now, we'll use a query param for the API key
      const url = `${this.config.ingestUrl}?key=${encodeURIComponent(this.config.apiKey)}`
      return navigator.sendBeacon(url, blob)
    } catch (e) {
      this.log(`sendBeacon failed: ${e}`)
      return false
    }
  }

  private async sendViaFetch(payload: NoticePayload): Promise<ApiResponse | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(this.config.ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Checkend-Ingestion-Key': this.config.apiKey,
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      return this.handleResponse(response)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        this.logError('Request timeout')
      } else {
        this.logError(`Failed to send notice: ${e}`)
      }
      return null
    }
  }

  private async handleResponse(response: Response): Promise<ApiResponse | null> {
    const status = response.status

    if (status === 201) {
      const result = await response.json() as ApiResponse
      this.log(`Notice sent successfully: id=${result.id} problem_id=${result.problem_id}`)
      return result
    }

    const body = await response.text().catch(() => '')

    switch (status) {
      case 400:
        this.logWarn(`Bad request: ${body}`)
        break
      case 401:
        this.logError('Authentication failed - check your API key')
        break
      case 422:
        this.logWarn(`Invalid notice payload: ${body}`)
        break
      case 429:
        this.logWarn('Rate limited by server - backing off')
        break
      default:
        if (status >= 500) {
          this.logError(`Server error: ${status} - ${body}`)
        } else {
          this.logError(`Unexpected response: ${status} - ${body}`)
        }
    }

    return null
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[Checkend] ${message}`)
    }
  }

  private logWarn(message: string): void {
    console.warn(`[Checkend] ${message}`)
  }

  private logError(message: string): void {
    console.error(`[Checkend] ${message}`)
  }
}
