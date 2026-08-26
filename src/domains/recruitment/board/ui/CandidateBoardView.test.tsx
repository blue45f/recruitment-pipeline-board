import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CandidateBoardView } from './CandidateBoardView'

describe('CandidateBoardView', () => {
  it('다섯 채용 단계를 정해진 순서로 표시한다', () => {
    render(<CandidateBoardView />)

    const board = screen.getByRole('region', {
      name: '채용 단계별 후보자 보드',
    })
    const headings = within(board).getAllByRole('heading', { level: 2 })

    expect(headings.map((heading) => heading.textContent)).toEqual([
      '서류검토',
      '면접',
      '처우협의',
      '최종합격',
      '불합격',
    ])
    expect(board).toHaveAttribute('tabindex', '0')
  })
})
