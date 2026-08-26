import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TextField } from '@/components/ui/TextField'

describe('TextField', () => {
  it('레이블과 설명을 입력 요소의 접근 가능한 정보로 연결한다', () => {
    render(
      <TextField
        description="후보자에게 연락할 때 사용할 주소입니다."
        label="이메일"
        name="email"
      />,
    )

    const input = screen.getByRole('textbox', { name: '이메일' })

    expect(input).toHaveAccessibleDescription(
      '후보자에게 연락할 때 사용할 주소입니다.',
    )
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('오류를 알리고 입력 요소를 유효하지 않은 상태로 표시한다', () => {
    render(
      <TextField
        error="이메일 형식을 확인해 주세요."
        label="이메일"
        name="email"
      />,
    )

    const input = screen.getByRole('textbox', { name: '이메일' })

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('이메일 형식을 확인해 주세요.')
    expect(screen.getByRole('alert')).toHaveTextContent(
      '이메일 형식을 확인해 주세요.',
    )
  })
})
