# @checkend/browser

[![npm version](https://badge.fury.io/js/@checkend%2Fbrowser.svg)](https://badge.fury.io/js/@checkend%2Fbrowser)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Official Browser SDK for [Checkend](https://github.com/furvur/checkend) error monitoring. Capture and report errors from browser applications with automatic error handling and context tracking.

## Features

- **Zero dependencies** - Lightweight, no external dependencies
- **Automatic error capture** - Captures `window.onerror` and unhandled promise rejections
- **Context tracking** - Attach user info and custom context to errors
- **Sensitive data filtering** - Automatically scrubs passwords, tokens, etc.
- **TypeScript support** - Full TypeScript definitions included
- **Testing utilities** - Mock SDK for unit testing

## Installation

```bash
npm install @checkend/browser
# or
yarn add @checkend/browser
# or
pnpm add @checkend/browser
```

## Quick Start

```typescript
import Checkend from '@checkend/browser'

Checkend.configure({
  apiKey: 'your-ingestion-key',
  // Optional: custom endpoint
  // endpoint: 'https://checkend.example.com',
})

// That's it! Unhandled errors are now automatically captured.
```

## Manual Error Reporting

```typescript
import { notify, notifySync } from '@checkend/browser'

try {
  // risky code
} catch (error) {
  notify(error as Error)
}

// With additional context
notify(error, {
  context: { orderId: 123 },
  user: { id: 'user-1', email: 'user@example.com' },
  tags: ['checkout', 'payment'],
  fingerprint: 'custom-grouping-key',
})

// Synchronous sending (returns promise)
const response = await notifySync(error)
```

## Configuration

```typescript
import Checkend from '@checkend/browser'

Checkend.configure({
  // Required
  apiKey: 'your-ingestion-key',

  // Optional - Checkend server URL (default: https://app.checkend.io)
  endpoint: 'https://checkend.example.com',

  // Optional - Environment name (auto-detected from hostname)
  environment: 'production',

  // Optional - Enable/disable reporting (default: true in production/staging)
  enabled: true,

  // Optional - Capture unhandled errors (default: true)
  captureUnhandled: true,

  // Optional - Capture unhandled promise rejections (default: true)
  captureUnhandledRejections: true,

  // Optional - Exceptions to ignore
  ignoredExceptions: ['MyCustomNotFoundError', /^Network/],

  // Optional - Keys to filter from context/request data
  filterKeys: ['creditCard', 'ssn'],

  // Optional - Callbacks before sending (return false to skip)
  beforeNotify: [
    (notice) => {
      notice.context.deployVersion = window.DEPLOY_VERSION
      return true // Return true to send, false to skip
    },
  ],

  // Optional - Request timeout in milliseconds (default: 15000)
  timeout: 15000,

  // Optional - Maximum notices to queue (default: 100)
  maxQueueSize: 100,

  // Optional - Use sendBeacon API (default: true)
  useSendBeacon: true,

  // Optional - Enable debug logging (default: false)
  debug: false,
})
```

## Context and User Tracking

```typescript
import { setContext, setUser, clear } from '@checkend/browser'

// Set context that will be included with all errors
setContext({
  accountId: 'acc-123',
  featureFlag: 'new_checkout',
})

// Track current user
setUser({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Jane Doe',
})

// Clear context (e.g., on logout)
clear()
```

## Testing

Use the Testing module to capture notices without sending them:

```typescript
import Checkend, { notify } from '@checkend/browser'
import { Testing } from '@checkend/browser/testing'

describe('Error handling', () => {
  beforeEach(() => {
    Testing.setup()
    Checkend.configure({ apiKey: 'test-key' })
  })

  afterEach(() => {
    Testing.teardown()
    Checkend.reset()
  })

  test('reports errors', () => {
    notify(new Error('Test error'))

    expect(Testing.notices).toHaveLength(1)
    expect(Testing.lastNotice?.errorClass).toBe('Error')
    expect(Testing.lastNotice?.message).toBe('Test error')
  })
})
```

### Testing API

| Method | Description |
|--------|-------------|
| `Testing.setup()` | Enable test mode, intercept network calls |
| `Testing.teardown()` | Restore normal mode, clear notices |
| `Testing.notices` | Array of captured Notice objects |
| `Testing.lastNotice` | Most recent notice |
| `Testing.firstNotice` | First captured notice |
| `Testing.noticeCount()` | Number of captured notices |
| `Testing.hasNotices()` | True if any notices captured |
| `Testing.clearNotices()` | Clear captured notices |

## Filtering Sensitive Data

The SDK automatically filters sensitive data from context and request data.

Default filtered keys: `password`, `secret`, `token`, `api_key`, `authorization`, `credit_card`, `cvv`, `ssn`

Add custom keys:

```typescript
Checkend.configure({
  apiKey: 'your-key',
  filterKeys: ['socialSecurityNumber', 'bankAccount'],
})
```

## Ignoring Exceptions

Some exceptions don't need to be reported:

```typescript
Checkend.configure({
  apiKey: 'your-key',
  ignoredExceptions: [
    // By exact message
    'ResizeObserver loop limit exceeded',
    // By regex pattern
    /^Script error/,
  ],
})
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

The SDK uses modern APIs like `fetch`, `Promise`, and `Blob`. For older browsers, you may need polyfills.

## Requirements

- No runtime dependencies
- Works in all modern browsers
- TypeScript 5.0+ (for types)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## License

MIT License. See [LICENSE](LICENSE) for details.
