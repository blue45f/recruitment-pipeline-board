import { CalendarDays } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type Ref } from 'react'

import { Badge } from '@/components/ui/Badge'
import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  type Candidate,
  type CandidateId,
} from '@/domains/recruitment/candidates/model'
import { cn } from '@/lib/classNames'

import { CANDIDATE_STAGE_PRESENTATION } from './candidateStagePresentation'
import { formatCandidateCompactDate } from './formatCandidateDate'

export type CandidateCardProps = Readonly<{
  buttonRef?: Ref<HTMLButtonElement>
  candidate: Candidate
  keyboardNavigationDescriptionId?: string
  onCandidateFocus?: (candidateId: CandidateId) => void
  onCandidateKeyDown?: (
    candidateId: CandidateId,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  tabIndex?: -1 | 0
}>

const INTENT_PREFETCH_DELAY_MS = 120

export function CandidateCard({
  buttonRef,
  candidate,
  keyboardNavigationDescriptionId,
  onCandidateFocus,
  onCandidateKeyDown,
  onOpenCandidate,
  onPrefetchCandidate,
  tabIndex,
}: CandidateCardProps) {
  const prefetchTimer = useRef<number | null>(null)
  const stage = CANDIDATE_STAGE_PRESENTATION[candidate.currentStage]
  const stageLabel = CANDIDATE_STAGE_LABELS[candidate.currentStage]
  const roleLabel = CANDIDATE_ROLE_LABELS[candidate.role]
  const cancelPrefetch = () => {
    if (prefetchTimer.current !== null) {
      window.clearTimeout(prefetchTimer.current)
      prefetchTimer.current = null
    }
  }
  const schedulePrefetch = () => {
    cancelPrefetch()
    prefetchTimer.current = window.setTimeout(() => {
      prefetchTimer.current = null
      onPrefetchCandidate?.(candidate.id)
    }, INTENT_PREFETCH_DELAY_MS)
  }

  useEffect(
    () => () => {
      if (prefetchTimer.current !== null) {
        window.clearTimeout(prefetchTimer.current)
      }
    },
    [],
  )

  return (
    <article>
      <button
        aria-describedby={keyboardNavigationDescriptionId}
        aria-haspopup="dialog"
        aria-keyshortcuts={
          keyboardNavigationDescriptionId
            ? 'ArrowUp ArrowDown Home End'
            : undefined
        }
        aria-label={`${candidate.name} 후보자, ${roleLabel}, 현재 단계 ${stageLabel}, 지원일 ${formatCandidateCompactDate(candidate.appliedAt)}, 상세 보기`}
        className="relative flex min-h-40 w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 text-left shadow-[0_1px_2px_rgba(24,32,51,0.04)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--color-cobalt)] hover:shadow-[0_10px_28px_rgba(24,32,51,0.10)] focus-visible:border-[var(--color-cobalt)] focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none"
        data-candidate-id={candidate.id}
        onBlur={cancelPrefetch}
        onClick={() => {
          cancelPrefetch()
          onOpenCandidate(candidate.id)
        }}
        onFocus={() => {
          schedulePrefetch()
          onCandidateFocus?.(candidate.id)
        }}
        onKeyDown={(event) => onCandidateKeyDown?.(candidate.id, event)}
        onPointerCancel={cancelPrefetch}
        onPointerEnter={schedulePrefetch}
        onPointerLeave={cancelPrefetch}
        ref={buttonRef}
        tabIndex={tabIndex}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn('absolute inset-y-0 left-0 w-1', stage.accentClassName)}
        />

        <span className="flex w-full items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-[-0.02em] text-[var(--color-ink)]">
              {candidate.name}
            </span>
            <span className="mt-1 block truncate text-sm text-[var(--color-muted)]">
              {roleLabel}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="font-data shrink-0 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--color-subtle)]"
          >
            C{stage.index}
          </span>
        </span>

        <span className="mt-auto w-full pt-3">
          <Badge tone={stage.badgeTone}>
            <span className="sr-only">현재 단계: </span>
            {stageLabel}
          </Badge>
          <span className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            <span className="shrink-0 whitespace-nowrap">지원일</span>
            <time className="font-data truncate" dateTime={candidate.appliedAt}>
              {formatCandidateCompactDate(candidate.appliedAt)}
            </time>
          </span>
        </span>
      </button>
    </article>
  )
}
