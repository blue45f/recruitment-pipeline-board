import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { generateCandidateFixtures } from '@/domains/recruitment/candidates/model'

import { groupCandidatesByStage } from '../model'
import { CandidateBoardView } from './CandidateBoardView'

describe('CandidateBoardView', () => {
  it('다섯 단계와 후보자 카드의 필수 정보를 표시한다', () => {
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })

    render(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(candidates)}
      />,
    )

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
    expect(within(board).getAllByRole('listitem')).toHaveLength(200)

    const firstCandidate = candidates[0]

    if (!firstCandidate) {
      throw new Error('테스트 후보자를 생성하지 못했습니다.')
    }

    const card = within(board)
      .getAllByRole('article')
      .find((article) => within(article).queryByText(firstCandidate.name))

    expect(card).toBeDefined()

    if (!card) {
      throw new Error('후보자 카드를 찾지 못했습니다.')
    }

    expect(within(card).getByText('지원일')).toBeInTheDocument()
    expect(within(card).getByText(/현재 단계:/)).toBeInTheDocument()
  })
})
