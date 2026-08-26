import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecruitmentBoard } from './RecruitmentBoard'

describe('RecruitmentBoard', () => {
  it('제목과 키보드로 탐색 가능한 다섯 단계 보드를 표시한다', () => {
    render(<RecruitmentBoard />)

    expect(
      screen.getByRole('heading', { name: '채용 후보자 보드', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: '채용 단계별 후보자 보드' }),
    ).toHaveAttribute('tabindex', '0')
    expect(
      screen.getAllByText('후보자 목록을 준비하고 있습니다.'),
    ).toHaveLength(5)
  })
})
