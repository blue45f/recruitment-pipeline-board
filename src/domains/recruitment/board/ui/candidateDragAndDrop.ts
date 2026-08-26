export { pointerIntersection as candidateStageCollisionDetector } from '@dnd-kit/collision'
import {
  AutoScroller,
  Cursor,
  Feedback,
  PointerActivationConstraints,
  PointerSensor,
  PreventSelection,
  type DragDropManagerInput,
} from '@dnd-kit/dom'
import { z } from 'zod'

import {
  candidateSchema,
  candidateStageSchema,
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

export const CANDIDATE_DRAG_TYPE = 'candidate'
export const CANDIDATE_STAGE_DROP_TYPE = 'candidate-stage'

const candidateDragDataSchema = z
  .object({
    kind: z.literal(CANDIDATE_DRAG_TYPE),
    candidate: candidateSchema,
  })
  .strict()

const candidateStageDropDataSchema = z
  .object({
    kind: z.literal(CANDIDATE_STAGE_DROP_TYPE),
    stage: candidateStageSchema,
  })
  .strict()

type CandidateDragData = z.infer<typeof candidateDragDataSchema>
type CandidateStageDropData = z.infer<typeof candidateStageDropDataSchema>
export type CandidateDragDropData = CandidateDragData | CandidateStageDropData

export type CandidateStageDropResolution = Readonly<{
  candidate: Candidate
  targetStage: CandidateStage
}>

export function candidateDragId(candidateId: CandidateId) {
  return `candidate:${candidateId}`
}

export function candidateStageDropId(stage: CandidateStage) {
  return `candidate-stage:${stage}`
}

export function readCandidateDragData(data: unknown) {
  const result = candidateDragDataSchema.safeParse(data)

  return result.success ? result.data : undefined
}

export function readCandidateStageDropData(data: unknown) {
  const result = candidateStageDropDataSchema.safeParse(data)

  return result.success ? result.data : undefined
}

export function resolveCandidateStageDrop(
  sourceData: unknown,
  targetData: unknown,
  canceled = false,
): CandidateStageDropResolution | undefined {
  if (canceled) return undefined

  const source = readCandidateDragData(sourceData)
  const target = readCandidateStageDropData(targetData)

  if (
    source === undefined ||
    target === undefined ||
    source.candidate.currentStage === target.stage
  ) {
    return undefined
  }

  return {
    candidate: source.candidate,
    targetStage: target.stage,
  }
}

type ConfiguredPlugins = Exclude<
  NonNullable<DragDropManagerInput['plugins']>,
  (...args: never[]) => unknown
>
type ConfiguredSensors = Exclude<
  NonNullable<DragDropManagerInput['sensors']>,
  (...args: never[]) => unknown
>

export const candidateDragDropPlugins = [
  AutoScroller,
  Cursor,
  Feedback,
  PreventSelection,
] satisfies ConfiguredPlugins

export const candidateDragDropSensors = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === 'touch'
        ? [
            new PointerActivationConstraints.Delay({
              value: 250,
              tolerance: 8,
            }),
          ]
        : [new PointerActivationConstraints.Distance({ value: 8 })],
  }),
] satisfies ConfiguredSensors
