import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip as RadixTooltip } from 'radix-ui'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { Tooltip } from '@/components/ui/Tooltip'

class ResizeObserverMock {
  disconnect = vi.fn()
  observe = vi.fn()
  unobserve = vi.fn()
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('Tooltip', () => {
  it('키보드 포커스로 설명을 열고 Escape로 닫는다', async () => {
    const user = userEvent.setup()

    render(
      <RadixTooltip.Provider delayDuration={0}>
        <Tooltip content="검색 조건 설정" delayDuration={0}>
          <button aria-label="필터" type="button">
            필터
          </button>
        </Tooltip>
      </RadixTooltip.Provider>,
    )

    const trigger = screen.getByRole('button', { name: '필터' })
    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '검색 조건 설정',
    )
    expect(trigger).toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })
  })
})
