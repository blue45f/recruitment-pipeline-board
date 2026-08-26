import { CalendarDays } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  type Candidate,
} from '@/domains/recruitment/candidates/model'
import { cn } from '@/lib/classNames'

import { CANDIDATE_STAGE_PRESENTATION } from './candidateStagePresentation'
import { formatCandidateCompactDate } from './formatCandidateDate'

export type CandidateCardProps = Readonly<{
  candidate: Candidate
}>

export function CandidateCard({ candidate }: CandidateCardProps) {
  const stage = CANDIDATE_STAGE_PRESENTATION[candidate.currentStage]
  const stageLabel = CANDIDATE_STAGE_LABELS[candidate.currentStage]
  const roleLabel = CANDIDATE_ROLE_LABELS[candidate.role]

  return (
    <article className="relative flex min-h-40 w-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-[0_1px_2px_rgba(24,32,51,0.04)]">
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
        <span className="font-data shrink-0 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--color-subtle)]">
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
    </article>
  )
}
