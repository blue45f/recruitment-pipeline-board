/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- 가로 스크롤 영역을 키보드만으로도 탐색할 수 있어야 한다. */
import {
  CANDIDATE_STAGES,
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

import { CandidateStageColumn } from './CandidateStageColumn'

export type CandidateBoardViewProps = Readonly<{
  candidatesByStage: Record<CandidateStage, readonly Candidate[]>
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  scrollResetKey?: string
}>

export function CandidateBoardView({
  candidatesByStage,
  onOpenCandidate,
  onPrefetchCandidate,
  scrollResetKey = 'initial',
}: CandidateBoardViewProps) {
  return (
    <div className="max-w-full overflow-hidden [contain:paint]">
      <div
        aria-label="채용 단계별 후보자 보드"
        className="max-w-full overflow-x-auto overscroll-x-contain pb-3 focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none focus-visible:ring-inset"
        role="region"
        tabIndex={0}
      >
        <div className="flex min-w-max gap-3 sm:gap-4">
          {CANDIDATE_STAGES.map((stage) => (
            <CandidateStageColumn
              candidates={candidatesByStage[stage]}
              key={stage}
              onOpenCandidate={onOpenCandidate}
              {...(onPrefetchCandidate === undefined
                ? {}
                : { onPrefetchCandidate })}
              scrollResetKey={scrollResetKey}
              stage={stage}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
