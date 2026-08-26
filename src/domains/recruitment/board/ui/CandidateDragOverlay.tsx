import { useDragOperation } from '@dnd-kit/react'
import { ArrowRight, GripVertical } from 'lucide-react'

import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
} from '@/domains/recruitment/candidates/model'

import {
  readCandidateDragData,
  readCandidateStageDropData,
  type CandidateDragDropData,
} from './candidateDragAndDrop'

export function CandidateDragOverlay() {
  const { source, target } = useDragOperation<CandidateDragDropData>()
  const sourceData = readCandidateDragData(source?.data)

  if (sourceData === undefined) return null

  const targetData = readCandidateStageDropData(target?.data)
  const { candidate } = sourceData
  const currentStageLabel = CANDIDATE_STAGE_LABELS[candidate.currentStage]
  const targetStageLabel = targetData
    ? CANDIDATE_STAGE_LABELS[targetData.stage]
    : '단계 선택 중'

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none w-72 rotate-[0.75deg] overflow-hidden rounded-xl border-2 border-[var(--color-cobalt)] bg-[var(--color-paper)] shadow-[var(--shadow-floating)] motion-reduce:rotate-0"
      data-candidate-drag-overlay=""
      data-testid="candidate-drag-overlay"
    >
      <div className="relative border-b border-[var(--color-line)] px-4 py-3 pl-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-[var(--color-cobalt)]" />
        <span className="flex items-center justify-between gap-3">
          <span className="font-data text-[0.6875rem] font-bold tracking-[0.16em] text-[var(--color-cobalt-strong)]">
            ROUTE / MOVE
          </span>
          <GripVertical className="size-4 text-[var(--color-muted)]" />
        </span>
        <strong className="mt-2 block truncate text-base tracking-[-0.02em] text-[var(--color-ink)]">
          {candidate.name}
        </strong>
        <span className="mt-0.5 block truncate text-sm text-[var(--color-muted)]">
          {CANDIDATE_ROLE_LABELS[candidate.role]}
        </span>
      </div>
      <div className="flex items-center gap-2 bg-[var(--color-cobalt-soft)] px-4 py-3 text-xs font-semibold text-[var(--color-ink)]">
        <span className="min-w-0 truncate">{currentStageLabel}</span>
        <ArrowRight className="size-3.5 shrink-0 text-[var(--color-cobalt)]" />
        <span className="min-w-0 truncate text-[var(--color-cobalt-strong)]">
          {targetStageLabel}
        </span>
      </div>
    </div>
  )
}
