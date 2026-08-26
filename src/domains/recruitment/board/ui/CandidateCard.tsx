import { ArrowRightLeft, CalendarDays, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type Ref } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
  activeAction?: CandidateCardAction
  candidate: Candidate
  detailButtonRef?: Ref<HTMLButtonElement>
  isStageChangeDisabled?: boolean
  isStageChangePending?: boolean
  keyboardNavigationDescriptionId?: string
  onCandidateActionFocus?: (
    candidateId: CandidateId,
    action: CandidateCardAction,
  ) => void
  onCandidateKeyDown?: (
    candidateId: CandidateId,
    action: CandidateCardAction,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => void
  onChangeStage: (candidate: Candidate) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  stageChangeButtonRef?: Ref<HTMLButtonElement>
}>

export type CandidateCardAction = 'detail' | 'stage'

const INTENT_PREFETCH_DELAY_MS = 120

export function CandidateCard({
  activeAction,
  candidate,
  detailButtonRef,
  isStageChangeDisabled = false,
  isStageChangePending = false,
  keyboardNavigationDescriptionId,
  onCandidateActionFocus,
  onCandidateKeyDown,
  onChangeStage,
  onOpenCandidate,
  onPrefetchCandidate,
  stageChangeButtonRef,
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
    <article className="relative min-h-40 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] shadow-[0_1px_2px_rgba(24,32,51,0.04)] transition-[border-color,box-shadow,transform] duration-150 focus-within:border-[var(--color-cobalt)] hover:-translate-y-0.5 hover:border-[var(--color-cobalt)] hover:shadow-[0_10px_28px_rgba(24,32,51,0.10)] motion-reduce:transform-none motion-reduce:transition-none">
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-1', stage.accentClassName)}
      />
      <button
        aria-describedby={
          activeAction === 'detail'
            ? keyboardNavigationDescriptionId
            : undefined
        }
        aria-haspopup="dialog"
        aria-keyshortcuts={
          activeAction === 'detail' && keyboardNavigationDescriptionId
            ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Home End'
            : undefined
        }
        aria-label={`${candidate.name} 후보자, ${roleLabel}, 현재 단계 ${stageLabel}, 지원일 ${formatCandidateCompactDate(candidate.appliedAt)}, 상세 보기`}
        className="flex min-h-40 w-full cursor-pointer flex-col p-4 pb-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] focus-visible:ring-inset"
        data-candidate-id={candidate.id}
        onBlur={cancelPrefetch}
        onClick={() => {
          cancelPrefetch()
          onOpenCandidate(candidate.id)
        }}
        onFocus={() => {
          schedulePrefetch()
          onCandidateActionFocus?.(candidate.id, 'detail')
        }}
        onKeyDown={(event) =>
          onCandidateKeyDown?.(candidate.id, 'detail', event)
        }
        onPointerCancel={cancelPrefetch}
        onPointerEnter={schedulePrefetch}
        onPointerLeave={cancelPrefetch}
        ref={detailButtonRef}
        tabIndex={activeAction === 'detail' ? 0 : -1}
        type="button"
      >
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
      <div className="border-t border-[var(--color-line)] p-2 pl-3">
        <Button
          aria-describedby={
            activeAction === 'stage'
              ? keyboardNavigationDescriptionId
              : undefined
          }
          aria-haspopup="dialog"
          aria-keyshortcuts={
            activeAction === 'stage' && keyboardNavigationDescriptionId
              ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Home End'
              : undefined
          }
          aria-busy={isStageChangePending || undefined}
          aria-label={
            isStageChangePending
              ? `${candidate.name} 후보자 저장 중 · 변경`
              : `${candidate.name} 후보자 단계 변경`
          }
          className="w-full"
          data-stage-change-candidate-id={candidate.id}
          disabled={isStageChangeDisabled}
          onClick={() => onChangeStage(candidate)}
          onFocus={() => onCandidateActionFocus?.(candidate.id, 'stage')}
          onKeyDown={(event) =>
            onCandidateKeyDown?.(candidate.id, 'stage', event)
          }
          ref={stageChangeButtonRef}
          size="sm"
          tabIndex={activeAction === 'stage' ? 0 : -1}
          variant="ghost"
        >
          {isStageChangePending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <ArrowRightLeft aria-hidden="true" className="size-4" />
          )}
          {isStageChangePending ? '저장 중 · 변경' : '단계 변경'}
        </Button>
      </div>
    </article>
  )
}
