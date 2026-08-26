import { useDragOperation, useDroppable } from '@dnd-kit/react'

import {
  CANDIDATE_STAGE_LABELS,
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'
import { cn } from '@/lib/classNames'

import { CANDIDATE_STAGE_PRESENTATION } from './candidateStagePresentation'
import type { CandidateBoardFocusRequest } from './candidateBoardFocus'
import {
  CANDIDATE_DRAG_TYPE,
  CANDIDATE_STAGE_DROP_TYPE,
  candidateStageCollisionDetector,
  candidateStageDropId,
  readCandidateDragData,
  type CandidateDragDropData,
} from './candidateDragAndDrop'
import { VirtualizedCandidateList } from './VirtualizedCandidateList'

export type CandidateStageColumnProps = Readonly<{
  candidates: readonly Candidate[]
  draggedCandidateId?: CandidateId
  focusRequest?: CandidateBoardFocusRequest
  onChangeStage: (candidate: Candidate) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate?: (candidateId: CandidateId) => void
  pendingCandidateIds: ReadonlySet<CandidateId>
  scrollResetKey: string
  stage: CandidateStage
  stageChangeDisabledCandidateIds?: ReadonlySet<CandidateId>
}>

const EMPTY_STAGE_CHANGE_DISABLED_CANDIDATE_IDS = new Set<CandidateId>()

export function CandidateStageColumn({
  candidates,
  draggedCandidateId,
  focusRequest,
  onChangeStage,
  onOpenCandidate,
  onPrefetchCandidate,
  pendingCandidateIds,
  scrollResetKey,
  stage,
  stageChangeDisabledCandidateIds = EMPTY_STAGE_CHANGE_DISABLED_CANDIDATE_IDS,
}: CandidateStageColumnProps) {
  const stageLabel = CANDIDATE_STAGE_LABELS[stage]
  const presentation = CANDIDATE_STAGE_PRESENTATION[stage]
  const headingId = `candidate-stage-${stage}`
  const navigationDescriptionId = `${headingId}-navigation-description`
  const prefetchCandidateProps =
    onPrefetchCandidate === undefined ? {} : { onPrefetchCandidate }
  const focusRequestProps = focusRequest === undefined ? {} : { focusRequest }
  const isDragActive = draggedCandidateId !== undefined
  const { isDropTarget, ref: dropTargetRef } =
    useDroppable<CandidateDragDropData>({
      id: candidateStageDropId(stage),
      accept: CANDIDATE_DRAG_TYPE,
      collisionDetector: candidateStageCollisionDetector,
      data: {
        kind: CANDIDATE_STAGE_DROP_TYPE,
        stage,
      },
      type: CANDIDATE_STAGE_DROP_TYPE,
    })
  const { source } = useDragOperation<CandidateDragDropData>()
  const draggedCandidate = readCandidateDragData(source?.data)?.candidate
  const isValidDropTarget =
    isDropTarget &&
    draggedCandidate !== undefined &&
    draggedCandidate.currentStage !== stage
  const isCurrentStageTarget =
    isDropTarget && draggedCandidate?.currentStage === stage

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none lg:w-[17rem] xl:w-[15.5rem] 2xl:w-[17rem]',
        isDragActive && 'border-[var(--color-line-strong)]',
        isValidDropTarget &&
          'border-[var(--color-cobalt)] bg-[var(--color-cobalt-soft)] shadow-[0_18px_40px_rgba(49,94,251,0.16)] ring-3 ring-[var(--color-focus)] ring-offset-2 ring-offset-[var(--color-fog)]',
      )}
      data-candidate-stage-drop-active={isValidDropTarget || undefined}
      data-candidate-stage-drop-current={isCurrentStageTarget || undefined}
      data-candidate-stage-drop-zone={stage}
      ref={dropTargetRef}
    >
      <div className="relative min-h-20 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3.5 pl-5">
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 left-0 w-1 transition-[width] duration-150 motion-reduce:transition-none',
            presentation.accentClassName,
            isValidDropTarget && 'w-2',
          )}
        />
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="font-data block text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--color-subtle)]">
              {isValidDropTarget
                ? 'MOVE TO / '
                : isCurrentStageTarget
                  ? 'CURRENT / '
                  : 'STAGE '}
              {presentation.index}
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
        이동할 수 있습니다. 키보드에서는 단계 변경 버튼을 눌러 이동할 단계를
        선택합니다. 포인터로는 같은 버튼을 끌어 다른 단계에 놓을 수 있습니다.
      </p>
      {candidates.length === 0 ? (
        <div className="h-[34rem] p-3">
          <p className="mb-3 grid min-h-32 place-items-center rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)] px-5 text-center text-sm leading-6 text-[var(--color-muted)]">
            {isValidDropTarget
              ? '여기에 놓아 후보자를 이동합니다.'
              : '이 단계에 후보자가 없습니다.'}
          </p>
        </div>
      ) : (
        <VirtualizedCandidateList
          candidates={candidates}
          descriptionId={navigationDescriptionId}
          {...(draggedCandidateId === undefined ? {} : { draggedCandidateId })}
          {...focusRequestProps}
          key={scrollResetKey}
          label={`${stageLabel} 후보자 ${candidates.length.toLocaleString('ko-KR')}명`}
          onChangeStage={onChangeStage}
          onOpenCandidate={onOpenCandidate}
          pendingCandidateIds={pendingCandidateIds}
          stageChangeDisabledCandidateIds={stageChangeDisabledCandidateIds}
          {...prefetchCandidateProps}
        />
      )}
    </section>
  )
}
