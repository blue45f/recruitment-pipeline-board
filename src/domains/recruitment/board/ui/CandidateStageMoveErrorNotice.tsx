import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/Button'
import { CANDIDATE_STAGE_LABELS } from '@/domains/recruitment/candidates/model'

import type { CandidateStageMoveFailure } from '../model'

export type CandidateStageMoveErrorNoticeProps = Readonly<{
  failure: CandidateStageMoveFailure
  onRetry: () => void
}>

export function CandidateStageMoveErrorNotice({
  failure,
  onRetry,
}: CandidateStageMoveErrorNoticeProps) {
  const titleId = useId()
  const targetStageLabel = CANDIDATE_STAGE_LABELS[failure.targetStage]

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--color-danger)]"
        />
        <div className="min-w-0">
          <h3
            className="text-sm font-bold text-[var(--color-ink)]"
            id={titleId}
          >
            {failure.candidate.name} 후보자의 단계 이동을 저장하지 못했어요
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            {targetStageLabel} 단계로 변경하지 못했습니다. {failure.message}
          </p>
        </div>
      </div>
      <Button
        aria-label={`${failure.candidate.name} 후보자 ${targetStageLabel} 단계 이동 다시 시도`}
        className="shrink-0"
        onClick={onRetry}
        size="sm"
        variant="secondary"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        다시 시도
      </Button>
    </section>
  )
}
