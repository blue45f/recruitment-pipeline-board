import { useDraggable } from '@dnd-kit/react'
import type { Ref } from 'react'

import { CandidateCard, type CandidateCardProps } from './CandidateCard'
import {
  CANDIDATE_DRAG_TYPE,
  candidateDragId,
  type CandidateDragDropData,
} from './candidateDragAndDrop'

type DraggableCandidateCardProps = CandidateCardProps

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
    return
  }

  if (ref !== null && ref !== undefined) {
    ref.current = value
  }
}

export function DraggableCandidateCard({
  candidate,
  isStageChangeDisabled = false,
  stageChangeButtonRef,
  ...props
}: DraggableCandidateCardProps) {
  const { handleRef, isDragSource, ref } = useDraggable<CandidateDragDropData>({
    id: candidateDragId(candidate.id),
    data: {
      kind: CANDIDATE_DRAG_TYPE,
      candidate,
    },
    disabled: isStageChangeDisabled,
    type: CANDIDATE_DRAG_TYPE,
  })

  return (
    <CandidateCard
      {...props}
      cardRef={ref}
      candidate={candidate}
      isDragging={isDragSource}
      isStageChangeDisabled={isStageChangeDisabled}
      stageChangeButtonRef={(button) => {
        handleRef(button)
        assignRef(stageChangeButtonRef, button)
      }}
    />
  )
}
