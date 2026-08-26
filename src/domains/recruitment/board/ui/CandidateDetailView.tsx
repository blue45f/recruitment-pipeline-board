import {
  ArrowRightLeft,
  BriefcaseBusiness,
  LoaderCircle,
  Mail,
} from 'lucide-react'
import { useId } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  type Candidate,
} from '@/domains/recruitment/candidates/model'

import { CANDIDATE_STAGE_PRESENTATION } from './candidateStagePresentation'
import { formatCandidateDate } from './formatCandidateDate'

export type CandidateDetailViewProps = Readonly<{
  candidate: Candidate
  isStageChangeDisabled?: boolean
  isStageChangePending?: boolean
  onChangeStage?: (candidate: Candidate) => void
}>

export function CandidateDetailView({
  candidate,
  isStageChangeDisabled = false,
  isStageChangePending = false,
  onChangeStage,
}: CandidateDetailViewProps) {
  const memoHeadingId = useId()
  const stage = CANDIDATE_STAGE_PRESENTATION[candidate.currentStage]
  const stageLabel = CANDIDATE_STAGE_LABELS[candidate.currentStage]

  return (
    <section
      aria-label={`${candidate.name} 후보자 상세 정보`}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="min-w-0">
          <p className="font-data text-xs font-semibold tracking-[0.14em] text-[var(--color-cobalt-strong)]">
            CANDIDATE · C{stage.index}
          </p>
          <h3 className="mt-1.5 text-xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere] break-words text-[var(--color-ink)]">
            {candidate.name}
          </h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <BriefcaseBusiness aria-hidden="true" className="size-4" />
            {CANDIDATE_ROLE_LABELS[candidate.role]}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={stage.badgeTone}>
            <span className="sr-only">현재 단계: </span>
            {stageLabel}
          </Badge>
          {onChangeStage ? (
            <Button
              aria-busy={isStageChangePending || undefined}
              aria-haspopup="dialog"
              aria-label={
                isStageChangePending
                  ? `${candidate.name} 후보자 저장 중 · 변경`
                  : `${candidate.name} 후보자 단계 변경`
              }
              data-stage-change-candidate-id={candidate.id}
              disabled={isStageChangeDisabled}
              onClick={() => onChangeStage(candidate)}
              size="sm"
              variant="secondary"
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
          ) : null}
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)]">
        <div className="min-w-0 border-b border-[var(--color-line)] pb-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">
            이메일
          </dt>
          <dd className="mt-1.5 min-w-0 text-sm font-semibold text-[var(--color-ink)]">
            <a
              className="inline-flex min-h-11 max-w-full items-start gap-2 py-3 [overflow-wrap:anywhere] break-words text-[var(--color-cobalt-strong)] underline decoration-[var(--color-cobalt-soft)] decoration-2 underline-offset-4 hover:decoration-[var(--color-cobalt)]"
              href={`mailto:${candidate.email}`}
            >
              <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {candidate.email}
            </a>
          </dd>
        </div>
        <div className="border-b border-[var(--color-line)] pb-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">
            경력
          </dt>
          <dd className="font-data mt-2 text-sm font-semibold text-[var(--color-ink)]">
            {candidate.experienceYears}년
          </dd>
        </div>
        <div className="border-b border-[var(--color-line)] pb-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">
            지원일
          </dt>
          <dd className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
            <time dateTime={candidate.appliedAt}>
              {formatCandidateDate(candidate.appliedAt)}
            </time>
          </dd>
        </div>
        <div className="border-b border-[var(--color-line)] pb-4">
          <dt className="text-xs font-semibold text-[var(--color-muted)]">
            현재 단계
          </dt>
          <dd className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
            {stageLabel}
          </dd>
        </div>
      </dl>

      <section aria-labelledby={memoHeadingId}>
        <h4
          className="text-sm font-bold text-[var(--color-ink)]"
          id={memoHeadingId}
        >
          검토 메모
        </h4>
        <p className="mt-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm leading-7 [overflow-wrap:anywhere] whitespace-pre-wrap text-[var(--color-ink)]">
          {candidate.memo}
        </p>
      </section>
    </section>
  )
}
