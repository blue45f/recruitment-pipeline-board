import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  generateCandidateFixtures,
} from '@/domains/recruitment/candidates/model'

import { groupCandidatesByStage } from '../model'
import { CandidateBoardView } from './CandidateBoardView'
import { formatCandidateCompactDate } from './formatCandidateDate'

describe('CandidateBoardView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('다섯 단계와 후보자 카드의 필수 정보를 표시하고 키보드로 상세를 연다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const onOpenCandidate = vi.fn()
    const onPrefetchCandidate = vi.fn()

    render(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(candidates)}
        onOpenCandidate={onOpenCandidate}
        onPrefetchCandidate={onPrefetchCandidate}
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

    const cardButton = within(card).getByRole('button', {
      name: `${firstCandidate.name} 후보자, ${CANDIDATE_ROLE_LABELS[firstCandidate.role]}, 현재 단계 ${CANDIDATE_STAGE_LABELS[firstCandidate.currentStage]}, 지원일 ${formatCandidateCompactDate(firstCandidate.appliedAt)}, 상세 보기`,
    })

    expect(cardButton).toHaveAttribute('aria-haspopup', 'dialog')
    cardButton.focus()
    await user.keyboard('{Enter}')

    expect(onOpenCandidate).toHaveBeenCalledExactlyOnceWith(firstCandidate.id)

    onOpenCandidate.mockClear()
    await user.keyboard(' ')

    expect(onOpenCandidate).toHaveBeenCalledExactlyOnceWith(firstCandidate.id)
  })

  it('짧게 스치는 포인터와 키보드 포커스는 상세 요청을 예약하지 않는다', () => {
    vi.useFakeTimers()
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const firstCandidate = candidates[0]
    const onPrefetchCandidate = vi.fn()

    if (!firstCandidate) {
      throw new Error('테스트 후보자를 생성하지 못했습니다.')
    }

    render(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(candidates)}
        onOpenCandidate={vi.fn()}
        onPrefetchCandidate={onPrefetchCandidate}
      />,
    )

    const cardButton = screen
      .getAllByRole('button', {
        name: new RegExp(`^${firstCandidate.name} 후보자,`),
      })
      .find(
        (button) =>
          button.getAttribute('data-candidate-id') === firstCandidate.id,
      )

    if (!cardButton) {
      throw new Error('의도 기반 조회를 검증할 후보자 카드를 찾지 못했습니다.')
    }

    fireEvent.pointerEnter(cardButton)
    act(() => vi.advanceTimersByTime(119))
    expect(onPrefetchCandidate).not.toHaveBeenCalled()

    fireEvent.pointerLeave(cardButton)
    act(() => vi.advanceTimersByTime(1))
    expect(onPrefetchCandidate).not.toHaveBeenCalled()

    fireEvent.focus(cardButton)
    fireEvent.blur(cardButton)
    act(() => vi.advanceTimersByTime(120))
    expect(onPrefetchCandidate).not.toHaveBeenCalled()

    fireEvent.focus(cardButton)
    act(() => vi.advanceTimersByTime(120))
    expect(onPrefetchCandidate).toHaveBeenCalledExactlyOnceWith(
      firstCandidate.id,
    )

    onPrefetchCandidate.mockClear()
    fireEvent.blur(cardButton)
    fireEvent.pointerEnter(cardButton)
    act(() => vi.advanceTimersByTime(120))
    expect(onPrefetchCandidate).toHaveBeenCalledExactlyOnceWith(
      firstCandidate.id,
    )
  })
})
