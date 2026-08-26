import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/Button'
import { CANDIDATE_STAGE_LABELS } from '@/domains/recruitment/candidates/model'

import type {
  CandidateStageMoveFailure,
  CandidateStageMoveVerificationRequired,
} from '../model'

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
            {failure.candidateName} 후보자의 단계 이동을 저장하지 못했어요
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            {targetStageLabel} 단계로 변경하지 못했습니다. {failure.safeMessage}
          </p>
        </div>
      </div>
      <Button
        aria-label={`${failure.candidateName} 후보자 ${targetStageLabel} 단계 이동 다시 시도`}
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

export type CandidateStageMoveVerificationNoticeProps = Readonly<{
  isVerifying?: boolean
  onVerify: () => void
  verification: CandidateStageMoveVerificationRequired
}>

export function CandidateStageMoveVerificationNotice({
  isVerifying = false,
  onVerify,
  verification,
}: CandidateStageMoveVerificationNoticeProps) {
  const titleId = useId()
  const targetStageLabel = CANDIDATE_STAGE_LABELS[verification.projectedStage]

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border border-[var(--color-cobalt)] bg-[var(--color-cobalt-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--color-cobalt-strong)]"
        />
        <div className="min-w-0">
          <h3
            className="text-sm font-bold text-[var(--color-ink)]"
            id={titleId}
          >
            {verification.candidateName} 후보자의 저장 결과를 확인해 주세요
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            {targetStageLabel} 단계로 이동한 결과가 아직 확정되지 않았습니다.{' '}
            {verification.safeMessage}
          </p>
        </div>
      </div>
      <Button
        aria-busy={isVerifying || undefined}
        aria-label={
          isVerifying
            ? `${verification.candidateName} 후보자 ${targetStageLabel} 단계 이동 상태 확인 중`
            : `${verification.candidateName} 후보자 ${targetStageLabel} 단계 이동 상태 다시 확인`
        }
        className="shrink-0"
        disabled={isVerifying}
        onClick={onVerify}
        size="sm"
        variant="secondary"
      >
        <RefreshCw
          aria-hidden="true"
          className={
            isVerifying
              ? 'size-4 animate-spin motion-reduce:animate-none'
              : 'size-4'
          }
        />
        {isVerifying ? '확인 중' : '상태 다시 확인'}
      </Button>
    </section>
  )
}
