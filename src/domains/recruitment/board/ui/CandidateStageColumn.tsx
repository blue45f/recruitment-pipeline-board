import {
  CANDIDATE_STAGE_LABELS,
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

import { CANDIDATE_STAGE_PRESENTATION } from './candidateStagePresentation'
import type { CandidateBoardFocusRequest } from './candidateBoardFocus'
import { VirtualizedCandidateList } from './VirtualizedCandidateList'

export type CandidateStageColumnProps = Readonly<{
  candidates: readonly Candidate[]
  focusRequest?: CandidateBoardFocusRequest
  onChangeStage: (candidate: Candidate) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  pendingCandidateIds: ReadonlySet<CandidateId>
  scrollResetKey: string
  stage: CandidateStage
}>

export function CandidateStageColumn({
  candidates,
  focusRequest,
  onChangeStage,
  onOpenCandidate,
  onPrefetchCandidate,
  pendingCandidateIds,
  scrollResetKey,
  stage,
}: CandidateStageColumnProps) {
  const stageLabel = CANDIDATE_STAGE_LABELS[stage]
  const presentation = CANDIDATE_STAGE_PRESENTATION[stage]
  const headingId = `candidate-stage-${stage}`
  const navigationDescriptionId = `${headingId}-navigation-description`
  const prefetchCandidateProps =
    onPrefetchCandidate === undefined ? {} : { onPrefetchCandidate }
  const focusRequestProps = focusRequest === undefined ? {} : { focusRequest }

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] lg:w-[17rem] xl:w-[15.5rem] 2xl:w-[17rem]"
    >
      <div className="relative min-h-20 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3.5 pl-5">
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 ${presentation.accentClassName}`}
        />
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="font-data block text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--color-subtle)]">
              STAGE {presentation.index}
            </span>
            <h2
              className="mt-1 text-base font-bold tracking-[-0.02em] text-[var(--color-ink)]"
              id={headingId}
            >
              {stageLabel}
            </h2>
          </span>
          <span className="font-data inline-flex min-w-8 items-center justify-center rounded-full bg-[var(--color-cobalt-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-cobalt-strong)]">
            <span className="sr-only">후보자 </span>
            {candidates.length.toLocaleString('ko-KR')}
            <span className="sr-only">명</span>
          </span>
        </span>
      </div>

      <p className="sr-only" id={navigationDescriptionId}>
        위아래 화살표로 이전 또는 다음 후보자로 이동하고, 좌우 화살표로 상세
        보기와 단계 변경 액션을 전환합니다. Home과 End로 처음과 마지막 후보자로
        이동할 수 있습니다.
      </p>
      {candidates.length === 0 ? (
        <div className="h-[34rem] p-3">
          <p className="mb-3 grid min-h-32 place-items-center rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)] px-5 text-center text-sm leading-6 text-[var(--color-muted)]">
            이 단계에 후보자가 없습니다.
          </p>
        </div>
      ) : (
        <VirtualizedCandidateList
          candidates={candidates}
          descriptionId={navigationDescriptionId}
          {...focusRequestProps}
          key={scrollResetKey}
          label={`${stageLabel} 후보자 ${candidates.length.toLocaleString('ko-KR')}명`}
          onChangeStage={onChangeStage}
          onOpenCandidate={onOpenCandidate}
          pendingCandidateIds={pendingCandidateIds}
          {...prefetchCandidateProps}
        />
      )}
    </section>
  )
}
