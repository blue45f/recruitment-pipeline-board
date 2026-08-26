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

import { groupCandidatesByStage, projectCandidateStages } from '../model'
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
    const onChangeStage = vi.fn()
    const onOpenCandidate = vi.fn()
    const onPrefetchCandidate = vi.fn()

    render(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(candidates)}
        onChangeStage={onChangeStage}
        onMoveCandidate={vi.fn()}
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
    expect(
      within(board)
        .getAllByRole('list')
        .every(
          (list) =>
            within(list)
              .getAllByRole('button')
              .filter((button) => button.tabIndex === 0).length === 1,
        ),
    ).toBe(true)

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

    const stageChangeButton = within(card).getByRole('button', {
      name: `${firstCandidate.name} 후보자 드래그 · 단계 변경`,
    })
    const navigationDescriptionId = `candidate-stage-${firstCandidate.currentStage}-navigation-description`

    expect(stageChangeButton).toHaveAttribute('tabindex', '-1')
    expect(stageChangeButton).toHaveAttribute(
      'data-candidate-drag-handle',
      firstCandidate.id,
    )
    expect(within(card).getAllByRole('button')).toHaveLength(2)
    expect(stageChangeButton).not.toHaveAttribute('aria-roledescription')
    expect(stageChangeButton).not.toHaveAttribute('aria-pressed')
    expect(stageChangeButton).not.toHaveAttribute('aria-grabbed')
    await user.keyboard('{ArrowRight}')

    expect(stageChangeButton).toHaveFocus()
    expect(stageChangeButton).toHaveAttribute('tabindex', '0')
    expect(cardButton).toHaveAttribute('tabindex', '-1')
    expect(stageChangeButton).toHaveAttribute(
      'aria-keyshortcuts',
      'ArrowLeft ArrowRight ArrowUp ArrowDown Home End',
    )
    expect(stageChangeButton).toHaveAttribute(
      'aria-describedby',
      navigationDescriptionId,
    )
    expect(
      screen
        .getAllByText(
          /포인터로는 같은 버튼을 끌어 다른 단계에 놓을 수 있습니다/,
        )
        .find(
          (description) =>
            description.getAttribute('id') === navigationDescriptionId,
        ),
    ).toBeInTheDocument()

    await user.keyboard(' ')

    expect(onChangeStage).toHaveBeenCalledExactlyOnceWith(firstCandidate)

    await user.keyboard('{ArrowLeft}')

    expect(cardButton).toHaveFocus()
    expect(cardButton).toHaveAttribute('tabindex', '0')
    expect(stageChangeButton).toHaveAttribute('tabindex', '-1')
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
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
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

  it('상하 이동은 같은 액션을 유지하고 좌우 이동은 카드 액션을 전환한다', async () => {
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
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
        onOpenCandidate={vi.fn()}
      />,
    )

    const candidateButton = (candidateId: string) =>
      screen
        .getAllByRole('button')
        .find(
          (button) => button.getAttribute('data-candidate-id') === candidateId,
        )
    const stageChangeButton = (candidateId: string) =>
      screen
        .getAllByRole('button')
        .find(
          (button) =>
            button.getAttribute('data-stage-change-candidate-id') ===
            candidateId,
        )
    const firstCandidateButton = candidateButton(firstCandidate.id)
    const firstStageChangeButton = stageChangeButton(firstCandidate.id)
    const secondStageChangeButton = stageChangeButton(secondCandidate.id)

    if (
      !firstCandidateButton ||
      !firstStageChangeButton ||
      !secondStageChangeButton
    ) {
      throw new Error('키보드 탐색을 검증할 후보자 액션을 찾지 못했습니다.')
    }

    firstCandidateButton.focus()

    expect(fireEvent.keyDown(firstCandidateButton, { key: 'ArrowUp' })).toBe(
      false,
    )
    expect(firstCandidateButton).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    expect(firstStageChangeButton).toHaveFocus()

    await user.keyboard('{ArrowDown}')

    expect(secondStageChangeButton).toHaveFocus()

    await user.keyboard('{ArrowUp}')

    expect(firstStageChangeButton).toHaveFocus()

    await user.keyboard('{ArrowLeft}')

    expect(firstCandidateButton).toHaveFocus()

    await user.keyboard('{ArrowDown}')

    expect(candidateButton(secondCandidate.id)).toHaveFocus()

    await user.keyboard('{Home}')

    expect(firstCandidateButton).toHaveFocus()
  })

  it('저장 중에도 단계 액션으로 이동해 다음 변경을 입력할 수 있다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const candidatesByStage = groupCandidatesByStage(candidates)
    const firstCandidate = candidatesByStage.document_review[0]
    const onChangeStage = vi.fn()

    if (!firstCandidate) {
      throw new Error('진행 중 상태를 검증할 후보자를 찾지 못했습니다.')
    }

    render(
      <CandidateBoardView
        candidatesByStage={candidatesByStage}
        onChangeStage={onChangeStage}
        onMoveCandidate={vi.fn()}
        onOpenCandidate={vi.fn()}
        pendingCandidateIds={new Set([firstCandidate.id])}
      />,
    )

    const list = screen.getByRole('list', {
      name: '서류검토 후보자 40명',
    })
    const detailButton = within(list).getByRole('button', {
      name: new RegExp(`^${firstCandidate.name} 후보자,`),
    })
    const stageChangeButton = within(list).getByRole('button', {
      name: `${firstCandidate.name} 후보자 저장 중 · 변경`,
    })

    expect(stageChangeButton).toBeEnabled()
    expect(stageChangeButton).toHaveAttribute('aria-busy', 'true')
    expect(detailButton).toHaveAttribute('tabindex', '0')
    expect(stageChangeButton).toHaveAttribute('tabindex', '-1')
    expect(
      within(list)
        .getAllByRole('button')
        .filter((button) => button.tabIndex === 0),
    ).toEqual([detailButton])

    detailButton.focus()
    await user.keyboard('{ArrowRight}')

    expect(stageChangeButton).toHaveFocus()
    expect(detailButton).toHaveAttribute('tabindex', '-1')
    expect(stageChangeButton).toHaveAttribute('tabindex', '0')

    await user.keyboard('{Enter}')

    expect(onChangeStage).toHaveBeenCalledWith(firstCandidate)
  })

  it('비활성화된 단계 액션 대신 같은 후보자의 상세 액션을 tab stop으로 유지한다', async () => {
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const candidatesByStage = groupCandidatesByStage(candidates)
    const candidate = candidatesByStage.document_review[0]

    if (!candidate) {
      throw new Error('비활성 단계 액션을 검증할 후보자를 찾지 못했습니다.')
    }

    const commonProps = {
      candidatesByStage,
      onChangeStage: vi.fn(),
      onMoveCandidate: vi.fn(),
      onOpenCandidate: vi.fn(),
    }
    const { rerender } = render(<CandidateBoardView {...commonProps} />)

    rerender(
      <CandidateBoardView
        {...commonProps}
        focusRequest={{ candidateId: candidate.id, requestId: 1 }}
        stageChangeDisabledCandidateIds={new Set([candidate.id])}
      />,
    )

    const list = screen.getByRole('list', {
      name: '서류검토 후보자 40명',
    })
    const detailButton = within(list).getByRole('button', {
      name: new RegExp(`^${candidate.name} 후보자,`),
    })
    const stageChangeButton = within(list).getByRole('button', {
      name: `${candidate.name} 후보자 드래그 · 단계 변경`,
    })

    await waitFor(() => expect(detailButton).toHaveFocus())
    expect(detailButton).toHaveAttribute('tabindex', '0')
    expect(stageChangeButton).toBeDisabled()
    expect(stageChangeButton).toHaveAttribute('tabindex', '-1')
    expect(
      within(list)
        .getAllByRole('button')
        .filter((button) => button.tabIndex === 0),
    ).toEqual([detailButton])
  })

  it('가상 범위 밖 목적 열로 이동한 후보자를 스크롤해 포커스를 복구한다', async () => {
    const candidates = generateCandidateFixtures({
      seed: 20260826,
      size: 1_000,
    })
    const initialCandidatesByStage = groupCandidatesByStage(candidates)
    const candidate = initialCandidatesByStage.document_review.at(-1)

    if (!candidate) {
      throw new Error('목적 열 포커스를 검증할 후보자를 찾지 못했습니다.')
    }

    const { rerender } = render(
      <CandidateBoardView
        candidatesByStage={initialCandidatesByStage}
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
        onOpenCandidate={vi.fn()}
      />,
    )
    const projectedCandidates = projectCandidateStages(
      candidates,
      new Map([[candidate.id, 'interview']]),
    )

    rerender(
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(projectedCandidates)}
        focusRequest={{ candidateId: candidate.id, requestId: 1 }}
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
        onOpenCandidate={vi.fn()}
        pendingCandidateIds={new Set([candidate.id])}
      />,
    )

    const targetList = screen.getByRole('list', {
      name: '면접 후보자 201명',
    })
    const targetButton = await within(targetList).findByRole('button', {
      name: `${candidate.name} 후보자 저장 중 · 변경`,
    })
    const targetItem = within(targetList)
      .getAllByRole('listitem')
      .find(
        (item) =>
          within(item).queryByRole('button', {
            name: `${candidate.name} 후보자 저장 중 · 변경`,
          }) === targetButton,
      )

    await waitFor(() => {
      expect(targetButton).toHaveFocus()
    })
    expect(targetButton).toHaveAttribute('tabindex', '0')
    expect(targetItem).toHaveAttribute('aria-setsize', '201')
    expect(Number(targetItem?.getAttribute('aria-posinset'))).toBeGreaterThan(1)
    expect(
      screen.getAllByRole('list').every(
        (list) =>
          within(list)
            .getAllByRole('button')
            .filter((button) => button.tabIndex === 0).length === 1,
      ),
    ).toBe(true)
  })

  it('검색 조건을 나타내는 key가 바뀔 때 각 단계의 스크롤을 처음으로 돌린다', () => {
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const candidatesByStage = groupCandidatesByStage(candidates)
    const { rerender } = render(
      <CandidateBoardView
        candidatesByStage={candidatesByStage}
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
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
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
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
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
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
        .getAllByRole('button', { name: /상세 보기$/ })
        .find((button) => button.tabIndex === 0)

      visibleTabStop =
        nextVisibleTabStop instanceof HTMLButtonElement
          ? nextVisibleTabStop
          : undefined
      const visibleTabStopItem = within(documentReviewList)
        .getAllByRole('listitem')
        .find(
          (item) =>
            within(item).queryByRole('button', { name: /상세 보기$/ }) ===
            visibleTabStop,
        )

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
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
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
      .getAllByRole('button', { name: /상세 보기$/ })
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
        .getAllByRole('button', { name: /상세 보기$/ })
        .find((button) => button.tabIndex === 0)

      visibleTabStop =
        nextVisibleTabStop instanceof HTMLButtonElement
          ? nextVisibleTabStop
          : undefined
      const visibleItem = within(documentReviewList)
        .getAllByRole('listitem')
        .find(
          (item) =>
            within(item).queryByRole('button', { name: /상세 보기$/ }) ===
            visibleTabStop,
        )

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
        onChangeStage={vi.fn()}
        onMoveCandidate={vi.fn()}
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
