/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- 가로 스크롤 영역을 키보드만으로도 탐색할 수 있어야 한다. */
import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/react'
import { useState } from 'react'

import {
  CANDIDATE_STAGES,
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

import type { CandidateBoardFocusRequest } from './candidateBoardFocus'
import { CandidateDragOverlay } from './CandidateDragOverlay'
import { CandidateStageColumn } from './CandidateStageColumn'
import {
  candidateDragDropPlugins,
  candidateDragDropSensors,
  readCandidateDragData,
  resolveCandidateStageDrop,
  type CandidateDragDropData,
} from './candidateDragAndDrop'

export type CandidateBoardViewProps = Readonly<{
  candidatesByStage: Record<CandidateStage, readonly Candidate[]>
  focusRequest?: CandidateBoardFocusRequest
  onChangeStage: (candidate: Candidate) => void
  onMoveCandidate: (candidate: Candidate, targetStage: CandidateStage) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  pendingCandidateIds?: ReadonlySet<CandidateId>
  scrollResetKey?: string
  stageChangeDisabledCandidateIds?: ReadonlySet<CandidateId>
}>

const EMPTY_PENDING_CANDIDATE_IDS = new Set<CandidateId>()

export function CandidateBoardView({
  candidatesByStage,
  focusRequest,
  onChangeStage,
  onMoveCandidate,
  onOpenCandidate,
  onPrefetchCandidate,
  pendingCandidateIds = EMPTY_PENDING_CANDIDATE_IDS,
  scrollResetKey = 'initial',
  stageChangeDisabledCandidateIds = EMPTY_PENDING_CANDIDATE_IDS,
}: CandidateBoardViewProps) {
  const [draggedCandidateId, setDraggedCandidateId] = useState<CandidateId>()
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedCandidateId(
      readCandidateDragData(event.operation.source?.data)?.candidate.id,
    )
  }
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedCandidateId(undefined)

    const resolution = resolveCandidateStageDrop(
      event.operation.source?.data,
      event.operation.target?.data,
      event.canceled,
    )

    if (resolution !== undefined) {
      onMoveCandidate(resolution.candidate, resolution.targetStage)
    }
  }

  return (
    <DragDropProvider<CandidateDragDropData>
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      plugins={candidateDragDropPlugins}
      sensors={candidateDragDropSensors}
    >
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
                {...(draggedCandidateId === undefined
                  ? {}
                  : { draggedCandidateId })}
                {...(focusRequest === undefined ? {} : { focusRequest })}
                key={stage}
                onChangeStage={onChangeStage}
                onOpenCandidate={onOpenCandidate}
                {...(onPrefetchCandidate === undefined
                  ? {}
                  : { onPrefetchCandidate })}
                scrollResetKey={scrollResetKey}
                pendingCandidateIds={pendingCandidateIds}
                stage={stage}
                stageChangeDisabledCandidateIds={
                  stageChangeDisabledCandidateIds
                }
              />
            ))}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null} style={{ zIndex: 1_000 }}>
        <CandidateDragOverlay />
      </DragOverlay>
    </DragDropProvider>
  )
}
