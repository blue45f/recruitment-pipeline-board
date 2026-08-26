import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { resetServerMockData, server } from '@/mocks/server'

configure({ asyncUtilTimeout: 5_000 })

if (globalThis.ResizeObserver === undefined) {
  class TestResizeObserver implements ResizeObserver {
    disconnect() {
      return undefined
    }

    observe() {
      return undefined
    }

    unobserve() {
      return undefined
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: TestResizeObserver,
    writable: true,
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetServerMockData()
})
afterAll(() => server.close())
