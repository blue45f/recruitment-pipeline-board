import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from '@tanstack/react-virtual'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'

import type {
  Candidate,
  CandidateId,
} from '@/domains/recruitment/candidates/model'

import type { CandidateBoardFocusRequest } from './candidateBoardFocus'
import { CandidateCard, type CandidateCardAction } from './CandidateCard'

const DEFAULT_ROOT_FONT_SIZE = 16
const CANDIDATE_CARD_ESTIMATED_HEIGHT_REM = 14
const CANDIDATE_CARD_GAP_REM = 0.75
const CANDIDATE_LIST_HEIGHT_REM = 34
const CANDIDATE_LIST_WIDTH_REM = 18
const VIRTUAL_OVERSCAN = 3

function getRootFontSize() {
  if (typeof document === 'undefined') {
    return DEFAULT_ROOT_FONT_SIZE
  }

  const rootFontSize = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  )

  return Number.isFinite(rootFontSize) ? rootFontSize : DEFAULT_ROOT_FONT_SIZE
}

function extractRangeWithActiveCandidate(
  range: Range,
  activeCandidateIndex: number,
) {
  const visibleIndexes = defaultRangeExtractor(range)

  if (
    activeCandidateIndex < 0 ||
    visibleIndexes.includes(activeCandidateIndex)
  ) {
    return visibleIndexes
  }

  return [...visibleIndexes, activeCandidateIndex].sort(
    (left, right) => left - right,
  )
}

type CandidateNavigationKey =
  'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'End' | 'Home'

type CandidateTraversalKey = 'ArrowDown' | 'ArrowUp' | 'End' | 'Home'

function isCandidateNavigationKey(key: string): key is CandidateNavigationKey {
  return [
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'End',
    'Home',
  ].includes(key)
}

function getTargetCandidateIndex(
  key: CandidateTraversalKey,
  currentIndex: number,
  candidateCount: number,
) {
  switch (key) {
    case 'ArrowDown':
      return Math.min(currentIndex + 1, candidateCount - 1)
    case 'ArrowUp':
      return Math.max(currentIndex - 1, 0)
    case 'End':
      return candidateCount - 1
    case 'Home':
      return 0
  }
}

export type VirtualizedCandidateListProps = Readonly<{
  candidates: readonly Candidate[]
  descriptionId: string
  focusRequest?: CandidateBoardFocusRequest
  label: string
  onChangeStage: (candidate: Candidate) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  pendingCandidateIds: ReadonlySet<CandidateId>
}>

export function VirtualizedCandidateList({
  candidates,
  descriptionId,
  focusRequest,
  label,
  onChangeStage,
  onOpenCandidate,
  onPrefetchCandidate,
  pendingCandidateIds,
}: VirtualizedCandidateListProps) {
  const scrollElementRef = useRef<HTMLUListElement>(null)
  const candidateDetailButtons = useRef(
    new Map<CandidateId, HTMLButtonElement>(),
  )
  const candidateStageButtons = useRef(
    new Map<CandidateId, HTMLButtonElement>(),
  )
  const pendingFocus = useRef<{
    action: CandidateCardAction
    candidateId: CandidateId
  } | null>(null)
  const handledFocusRequestId = useRef<number | null>(null)
  const [activeAction, setActiveAction] =
    useState<CandidateCardAction>('detail')
  const [activeCandidateId, setActiveCandidateId] =
    useState<CandidateId | null>(null)
  const [rootFontSize, setRootFontSize] = useState(getRootFontSize)
  const resolvedActiveCandidateId = candidates.some(
    ({ id }) => id === activeCandidateId,
  )
    ? activeCandidateId
    : (candidates[0]?.id ?? null)
  const activeCandidateIndex = candidates.findIndex(
    ({ id }) => id === resolvedActiveCandidateId,
  )
  const estimatedCandidateHeight =
    rootFontSize * CANDIDATE_CARD_ESTIMATED_HEIGHT_REM
  const candidateGap = rootFontSize * CANDIDATE_CARD_GAP_REM

  useEffect(() => {
    const syncRootFontSize = () => {
      const nextRootFontSize = getRootFontSize()

      setRootFontSize((currentRootFontSize) =>
        currentRootFontSize === nextRootFontSize
          ? currentRootFontSize
          : nextRootFontSize,
      )
    }

    window.addEventListener('resize', syncRootFontSize)

    return () => window.removeEventListener('resize', syncRootFontSize)
  }, [])

  // TanStack Virtual은 내부 측정 상태를 직접 관리한다.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: candidates.length,
    estimateSize: () => estimatedCandidateHeight,
    gap: candidateGap,
    getItemKey: (index) => candidates[index]?.id ?? index,
    getScrollElement: () => scrollElementRef.current,
    initialRect: {
      height: rootFontSize * CANDIDATE_LIST_HEIGHT_REM,
      width: rootFontSize * CANDIDATE_LIST_WIDTH_REM,
    },
    overscan: VIRTUAL_OVERSCAN,
    paddingEnd: candidateGap,
    paddingStart: candidateGap,
    rangeExtractor: (range) =>
      extractRangeWithActiveCandidate(range, activeCandidateIndex),
    useFlushSync: false,
  })
  const virtualCandidates = virtualizer.getVirtualItems()

  useLayoutEffect(() => {
    if (
      focusRequest === undefined ||
      handledFocusRequestId.current === focusRequest.requestId
    ) {
      return
    }

    const targetIndex = candidates.findIndex(
      ({ id }) => id === focusRequest.candidateId,
    )

    if (targetIndex < 0) {
      return
    }

    const action = pendingCandidateIds.has(focusRequest.candidateId)
      ? 'detail'
      : 'stage'

    handledFocusRequestId.current = focusRequest.requestId
    pendingFocus.current = {
      action,
      candidateId: focusRequest.candidateId,
    }
    setActiveAction(action)
    setActiveCandidateId(focusRequest.candidateId)
    virtualizer.scrollToIndex(targetIndex, { align: 'center' })
  }, [candidates, focusRequest, pendingCandidateIds, virtualizer])

  useLayoutEffect(() => {
    const pendingTarget = pendingFocus.current

    if (!pendingTarget) {
      return
    }

    const candidateButton =
      pendingTarget.action === 'detail'
        ? candidateDetailButtons.current.get(pendingTarget.candidateId)
        : candidateStageButtons.current.get(pendingTarget.candidateId)

    if (candidateButton) {
      pendingFocus.current = null
      candidateButton.focus({ preventScroll: true })
    }
  })

  const moveFocus = (
    candidateId: CandidateId,
    action: CandidateCardAction,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!isCandidateNavigationKey(event.key)) {
      return
    }

    const currentIndex = candidates.findIndex(({ id }) => id === candidateId)

    if (currentIndex < 0) {
      return
    }

    event.preventDefault()

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const targetAction =
        event.key === 'ArrowLeft' || pendingCandidateIds.has(candidateId)
          ? 'detail'
          : 'stage'

      if (targetAction === action) {
        return
      }

      pendingFocus.current = { action: targetAction, candidateId }
      setActiveAction(targetAction)
      setActiveCandidateId(candidateId)
      return
    }

    const targetIndex = getTargetCandidateIndex(
      event.key,
      currentIndex,
      candidates.length,
    )
    const targetCandidate = candidates[targetIndex]

    if (!targetCandidate || targetCandidate.id === candidateId) {
      return
    }

    const targetAction =
      action === 'stage' && pendingCandidateIds.has(targetCandidate.id)
        ? 'detail'
        : action

    pendingFocus.current = {
      action: targetAction,
      candidateId: targetCandidate.id,
    }
    setActiveAction(targetAction)
    setActiveCandidateId(targetCandidate.id)
    virtualizer.scrollToIndex(targetIndex, { align: 'auto' })
  }
  const openCandidate = (candidateId: CandidateId) => {
    setActiveCandidateId(candidateId)
    onOpenCandidate(candidateId)
  }
  const reconcileTabStopWithViewport = () => {
    const scrollElement = scrollElementRef.current

    if (!scrollElement) {
      return
    }

    const candidateAtScrollOffset = virtualizer.getVirtualItemForOffset(
      scrollElement.scrollTop,
    )
    let firstVisibleIndex = 0

    if (candidateAtScrollOffset) {
      const nextCandidateOffset =
        candidateAtScrollOffset.end <= scrollElement.scrollTop ? 1 : 0

      firstVisibleIndex = Math.min(
        candidateAtScrollOffset.index + nextCandidateOffset,
        candidates.length - 1,
      )
    }

    const firstVisibleCandidate = candidates[firstVisibleIndex]

    if (
      firstVisibleCandidate &&
      firstVisibleCandidate.id !== resolvedActiveCandidateId
    ) {
      setActiveCandidateId(firstVisibleCandidate.id)
    }
  }
  const updateTabStopAfterScroll = () => {
    const scrollElement = scrollElementRef.current

    if (!scrollElement || scrollElement.contains(document.activeElement)) {
      return
    }

    reconcileTabStopWithViewport()
  }
  const updateTabStopAfterLeavingList = (
    event: FocusEvent<HTMLUListElement>,
  ) => {
    const nextFocusedElement = event.relatedTarget

    if (
      pendingFocus.current ||
      (nextFocusedElement instanceof Node &&
        event.currentTarget.contains(nextFocusedElement))
    ) {
      return
    }

    reconcileTabStopWithViewport()
  }

  return (
    <ul
      aria-describedby={descriptionId}
      aria-label={label}
      className="relative m-0 h-[34rem] [scrollbar-gutter:stable] list-none overflow-x-hidden overflow-y-auto overscroll-contain px-3 [overflow-anchor:none]"
      data-virtualized-candidate-list=""
      onBlurCapture={updateTabStopAfterLeavingList}
      onScroll={updateTabStopAfterScroll}
      ref={scrollElementRef}
    >
      <li
        aria-hidden="true"
        className="pointer-events-none w-full"
        style={{ height: virtualizer.getTotalSize() }}
      />
      {virtualCandidates.map((virtualCandidate) => {
        const candidate = candidates[virtualCandidate.index]

        if (!candidate) {
          return null
        }

        const resolvedActiveAction = pendingCandidateIds.has(candidate.id)
          ? 'detail'
          : activeAction

        return (
          <li
            aria-posinset={virtualCandidate.index + 1}
            aria-setsize={candidates.length}
            data-index={virtualCandidate.index}
            data-virtualized-candidate-item=""
            key={virtualCandidate.key}
            ref={virtualizer.measureElement}
            style={{
              left: candidateGap,
              position: 'absolute',
              right: candidateGap,
              top: 0,
              transform: `translateY(${virtualCandidate.start}px)`,
            }}
          >
            <CandidateCard
              {...(candidate.id === resolvedActiveCandidateId
                ? { activeAction: resolvedActiveAction }
                : {})}
              detailButtonRef={(button) => {
                if (button) {
                  candidateDetailButtons.current.set(candidate.id, button)
                } else {
                  candidateDetailButtons.current.delete(candidate.id)
                }
              }}
              candidate={candidate}
              isStageChangePending={pendingCandidateIds.has(candidate.id)}
              {...(candidate.id === resolvedActiveCandidateId
                ? { keyboardNavigationDescriptionId: descriptionId }
                : {})}
              onCandidateActionFocus={(candidateId, action) => {
                setActiveAction(action)
                setActiveCandidateId(candidateId)
              }}
              onCandidateKeyDown={moveFocus}
              onChangeStage={onChangeStage}
              onOpenCandidate={openCandidate}
              {...(onPrefetchCandidate === undefined
                ? {}
                : { onPrefetchCandidate })}
              stageChangeButtonRef={(button) => {
                if (button) {
                  candidateStageButtons.current.set(candidate.id, button)
                } else {
                  candidateStageButtons.current.delete(candidate.id)
                }
              }}
            />
          </li>
        )
      })}
    </ul>
  )
}
