import { act, screen } from '@testing-library/react'
import type { Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bootstrap } from '@/app/bootstrap'

describe('bootstrap', () => {
  let appRoot: Root | undefined

  afterEach(() => {
    if (appRoot !== undefined) {
      act(() => appRoot?.unmount())
    }
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('초기화 작업이 실패하면 복구 화면을 렌더링한다', async () => {
    const rootElement = document.createElement('div')
    const initializationError = new Error('mock worker 시작 실패')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    document.body.append(rootElement)

    await act(async () => {
      appRoot = await bootstrap(rootElement, {
        loadApp: async () => ({ App: () => <p>애플리케이션</p> }),
        startMocking: async () => Promise.reject(initializationError),
      })
    })

    expect(
      screen.getByRole('heading', { name: '앱을 준비하지 못했어요' }),
    ).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith(
      '애플리케이션 초기화에 실패했습니다.',
      initializationError,
    )
  })
})
