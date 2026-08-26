import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from '@tanstack/react-virtual'
import {
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

import { CandidateCard } from './CandidateCard'

const DEFAULT_ROOT_FONT_SIZE = 16
const CANDIDATE_CARD_MIN_HEIGHT_REM = 10
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

type CandidateNavigationKey = 'ArrowDown' | 'ArrowUp' | 'End' | 'Home'

function isCandidateNavigationKey(key: string): key is CandidateNavigationKey {
  return ['ArrowDown', 'ArrowUp', 'End', 'Home'].includes(key)
}

function getTargetCandidateIndex(
  key: CandidateNavigationKey,
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
  label: string
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
}>

export function VirtualizedCandidateList({
  candidates,
  descriptionId,
  label,
  onOpenCandidate,
  onPrefetchCandidate,
}: VirtualizedCandidateListProps) {
  const scrollElementRef = useRef<HTMLUListElement>(null)
  const candidateButtons = useRef(new Map<CandidateId, HTMLButtonElement>())
  const pendingFocusCandidateId = useRef<CandidateId | null>(null)
  const [activeCandidateId, setActiveCandidateId] =
    useState<CandidateId | null>(null)
  const resolvedActiveCandidateId = candidates.some(
    ({ id }) => id === activeCandidateId,
  )
    ? activeCandidateId
    : (candidates[0]?.id ?? null)
  const activeCandidateIndex = candidates.findIndex(
    ({ id }) => id === resolvedActiveCandidateId,
  )
  const rootFontSize = getRootFontSize()
  const estimatedCandidateHeight = rootFontSize * CANDIDATE_CARD_MIN_HEIGHT_REM
  const candidateGap = rootFontSize * CANDIDATE_CARD_GAP_REM

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
    const pendingCandidateId = pendingFocusCandidateId.current

    if (!pendingCandidateId) {
      return
    }

    const candidateButton = candidateButtons.current.get(pendingCandidateId)

    if (candidateButton) {
      pendingFocusCandidateId.current = null
      candidateButton.focus({ preventScroll: true })
    }
  })

  const moveFocus = (
    candidateId: CandidateId,
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

    const targetIndex = getTargetCandidateIndex(
      event.key,
      currentIndex,
      candidates.length,
    )
    const targetCandidate = candidates[targetIndex]

    if (!targetCandidate || targetCandidate.id === candidateId) {
      return
    }

    pendingFocusCandidateId.current = targetCandidate.id
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
      pendingFocusCandidateId.current ||
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
              buttonRef={(button) => {
                if (button) {
                  candidateButtons.current.set(candidate.id, button)
                } else {
                  candidateButtons.current.delete(candidate.id)
                }
              }}
              candidate={candidate}
              {...(candidate.id === resolvedActiveCandidateId
                ? { keyboardNavigationDescriptionId: descriptionId }
                : {})}
              onCandidateFocus={setActiveCandidateId}
              onCandidateKeyDown={moveFocus}
              onOpenCandidate={openCandidate}
              {...(onPrefetchCandidate === undefined
                ? {}
                : { onPrefetchCandidate })}
              tabIndex={candidate.id === resolvedActiveCandidateId ? 0 : -1}
            />
          </li>
        )
      })}
    </ul>
  )
}
