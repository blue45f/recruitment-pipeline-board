import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  generateCandidateFixtures,
} from '@/domains/recruitment/candidates/model'
import { installVirtualizedListDomMocks } from '@/test/installVirtualizedListDomMocks'

import { groupCandidatesByStage } from '../model'
import { CandidateBoardView } from './CandidateBoardView'
import { formatCandidateCompactDate } from './formatCandidateDate'

describe('CandidateBoardView', () => {
  let restoreVirtualizedListDom: (() => void) | undefined

  beforeAll(() => {
    restoreVirtualizedListDom = installVirtualizedListDomMocks()
  })

  afterAll(() => {
    restoreVirtualizedListDom?.()
  })

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
    const renderedItems = within(board).getAllByRole('listitem')

    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThan(60)
    expect(renderedItems.every((item) => item.ariaSetSize === '40')).toBe(true)

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

  it('1,000명에서도 보이는 카드만 렌더링하고 End로 마지막 후보자를 연다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({
      seed: 20260826,
      size: 1_000,
    })
    const candidatesByStage = groupCandidatesByStage(candidates)
    const documentReviewCandidates = candidatesByStage.document_review
    const firstCandidate = documentReviewCandidates[0]
    const lastCandidate = documentReviewCandidates.at(-1)
    const onOpenCandidate = vi.fn()

    if (!firstCandidate || !lastCandidate) {
      throw new Error('가상 목록을 검증할 후보자를 생성하지 못했습니다.')
    }

    render(
      <CandidateBoardView
        candidatesByStage={candidatesByStage}
        onOpenCandidate={onOpenCandidate}
      />,
    )

    const renderedItems = screen.getAllByRole('listitem')

    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThanOrEqual(60)
    expect(renderedItems.every((item) => item.ariaSetSize === '200')).toBe(true)

    const firstCandidateButton = screen.getByRole('button', {
      name: new RegExp(`^${firstCandidate.name} 후보자,`),
    })

    firstCandidateButton.focus()
    await user.keyboard('{End}')

    const lastCandidateButton = await screen.findByRole('button', {
      name: new RegExp(`^${lastCandidate.name} 후보자,`),
    })
    const lastCandidateItem = screen.getAllByRole('listitem').find(
      (item) =>
        within(item).queryByRole('button', {
          name: new RegExp(`^${lastCandidate.name} 후보자,`),
        }) === lastCandidateButton,
    )

    expect(lastCandidateButton).toHaveFocus()
    expect(lastCandidateItem).toHaveAttribute('aria-posinset', '200')

    await user.keyboard('{Enter}')

    expect(onOpenCandidate).toHaveBeenCalledExactlyOnceWith(lastCandidate.id)
  })

  it('화살표와 Home으로 같은 단계의 후보자 포커스를 이동한다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const candidatesByStage = groupCandidatesByStage(candidates)
    const stageCandidates = candidatesByStage.document_review
    const firstCandidate = stageCandidates[0]
    const secondCandidate = stageCandidates[1]

    if (!firstCandidate || !secondCandidate) {
      throw new Error('키보드 탐색을 검증할 후보자를 생성하지 못했습니다.')
    }

    render(
      <CandidateBoardView
        candidatesByStage={candidatesByStage}
        onOpenCandidate={vi.fn()}
      />,
    )

    const candidateButton = (candidateId: string) =>
      screen
        .getAllByRole('button')
        .find(
          (button) => button.getAttribute('data-candidate-id') === candidateId,
        )
    const firstCandidateButton = candidateButton(firstCandidate.id)

    if (!firstCandidateButton) {
      throw new Error('첫 후보자 버튼을 찾지 못했습니다.')
    }

    firstCandidateButton.focus()

    expect(fireEvent.keyDown(firstCandidateButton, { key: 'ArrowUp' })).toBe(
      false,
    )
    expect(firstCandidateButton).toHaveFocus()

    await user.keyboard('{ArrowDown}')

    expect(candidateButton(secondCandidate.id)).toHaveFocus()

    await user.keyboard('{Home}')

    expect(firstCandidateButton).toHaveFocus()
  })

  it('검색 조건을 나타내는 key가 바뀔 때 각 단계의 스크롤을 처음으로 돌린다', () => {
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const candidatesByStage = groupCandidatesByStage(candidates)
    const { rerender } = render(
      <CandidateBoardView
        candidatesByStage={candidatesByStage}
        onOpenCandidate={vi.fn()}
        scrollResetKey="all"
      />,
    )
    const documentReviewList = screen.getByRole('list', {
      name: '서류검토 후보자 40명',
    })

    act(() => documentReviewList.scrollTo({ top: 1_200 }))

    expect(documentReviewList.scrollTop).toBe(1_200)

    rerender(
      <CandidateBoardView
        candidatesByStage={candidatesByStage}
        onOpenCandidate={vi.fn()}
        scrollResetKey="frontend-only"
      />,
    )

    const resetDocumentReviewList = screen.getByRole('list', {
      name: '서류검토 후보자 40명',
    })

    expect(resetDocumentReviewList).not.toBe(documentReviewList)
    expect(resetDocumentReviewList.scrollTop).toBe(0)
  })

  it('목록 밖에서 스크롤하면 첫 보이는 후보자를 다음 tab stop으로 삼는다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })

    render(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(candidates)}
        onOpenCandidate={vi.fn()}
      />,
    )

    const board = screen.getByRole('region', {
      name: '채용 단계별 후보자 보드',
    })
    const documentReviewList = screen.getByRole('list', {
      name: '서류검토 후보자 40명',
    })

    act(() => documentReviewList.scrollTo({ top: 3_000 }))

    let visibleTabStop: HTMLButtonElement | undefined

    await waitFor(() => {
      const nextVisibleTabStop = within(documentReviewList)
        .getAllByRole('button')
        .find((button) => button.tabIndex === 0)

      visibleTabStop =
        nextVisibleTabStop instanceof HTMLButtonElement
          ? nextVisibleTabStop
          : undefined
      const visibleTabStopItem = within(documentReviewList)
        .getAllByRole('listitem')
        .find((item) => within(item).queryByRole('button') === visibleTabStop)

      expect(visibleTabStop).toBeDefined()
      expect(
        Number(visibleTabStopItem?.getAttribute('aria-posinset')),
      ).toBeGreaterThan(1)
    })

    board.focus()
    await user.tab()

    expect(visibleTabStop).toHaveFocus()
  })

  it('포커스한 채 스크롤한 뒤 목록을 떠나도 현재 위치의 tab stop을 복구한다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })

    render(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(candidates)}
        onOpenCandidate={vi.fn()}
      />,
    )

    const board = screen.getByRole('region', {
      name: '채용 단계별 후보자 보드',
    })
    const documentReviewList = screen.getByRole('list', {
      name: '서류검토 후보자 40명',
    })
    const initialTabStop = within(documentReviewList)
      .getAllByRole('button')
      .find((button) => button.tabIndex === 0)

    if (!initialTabStop) {
      throw new Error('초기 후보자 tab stop을 찾지 못했습니다.')
    }

    initialTabStop.focus()
    act(() => documentReviewList.scrollTo({ top: 3_000 }))

    expect(initialTabStop).toHaveFocus()
    expect(initialTabStop).toHaveAttribute('tabindex', '0')

    board.focus()

    let visibleTabStop: HTMLButtonElement | undefined

    await waitFor(() => {
      const nextVisibleTabStop = within(documentReviewList)
        .getAllByRole('button')
        .find((button) => button.tabIndex === 0)

      visibleTabStop =
        nextVisibleTabStop instanceof HTMLButtonElement
          ? nextVisibleTabStop
          : undefined
      const visibleItem = within(documentReviewList)
        .getAllByRole('listitem')
        .find((item) => within(item).queryByRole('button') === visibleTabStop)

      expect(
        Number(visibleItem?.getAttribute('aria-posinset')),
      ).toBeGreaterThan(1)
    })

    const scrollTopBeforeTab = documentReviewList.scrollTop

    await user.tab()

    expect(visibleTabStop).toHaveFocus()
    expect(documentReviewList.scrollTop).toBe(scrollTopBeforeTab)
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
