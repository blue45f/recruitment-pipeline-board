import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BootErrorPage } from '@/app/BootErrorPage'

describe('BootErrorPage', () => {
  it('초기화 실패를 설명하고 다시 불러올 수 있다', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()

    render(<BootErrorPage onRetry={handleRetry} />)

    expect(
      screen.getByRole('heading', { name: '앱을 준비하지 못했어요' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))

    expect(handleRetry).toHaveBeenCalledOnce()
  })
})
