import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('키보드와 포인터가 같은 동작을 실행한다', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>다시 시도</Button>)

    const button = screen.getByRole('button', { name: '다시 시도' })
    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')

    expect(handleClick).toHaveBeenCalledTimes(2)
  })

  it('asChild를 사용하면 자식 요소의 의미와 속성을 유지한다', () => {
    render(
      <Button aria-busy asChild variant="secondary">
        <a href="/candidates">후보자 목록 열기</a>
      </Button>,
    )

    const link = screen.getByRole('link', { name: '후보자 목록 열기' })

    expect(link).toHaveAttribute('href', '/candidates')
    expect(link).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.queryByRole('button', { name: '후보자 목록 열기' }),
    ).not.toBeInTheDocument()
  })

  it('로딩 중에는 상태를 알리고 실행을 막는다', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Button
        loading
        loadingLabel="변경 사항을 저장하는 중"
        onClick={handleClick}
      >
        변경 저장
      </Button>,
    )

    const button = screen.getByRole('button', {
      name: '변경 사항을 저장하는 중',
    })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('busy 상태만 전달하면 실행을 막지 않고 현재 상태를 알린다', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Button aria-busy onClick={handleClick}>
        저장 중 · 다시 변경
      </Button>,
    )

    const button = screen.getByRole('button', {
      name: '저장 중 · 다시 변경',
    })

    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await user.click(button)

    expect(handleClick).toHaveBeenCalledOnce()
  })
})
