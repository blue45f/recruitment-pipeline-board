import {
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '../../candidates/model'

export type CandidateStageProjection = ReadonlyMap<CandidateId, CandidateStage>

export function projectCandidateStage(
  candidate: Candidate,
  stageProjectionByCandidateId: CandidateStageProjection,
): Candidate {
  const projectedStage = stageProjectionByCandidateId.get(candidate.id)

  if (
    projectedStage === undefined ||
    projectedStage === candidate.currentStage
  ) {
    return candidate
  }

  return {
    ...candidate,
    currentStage: projectedStage,
  }
}

export function projectCandidateStages(
  candidates: readonly Candidate[],
  stageProjectionByCandidateId: CandidateStageProjection,
): readonly Candidate[] {
  let hasChanged = false
  const projectedCandidates = candidates.map((candidate) => {
    const projectedCandidate = projectCandidateStage(
      candidate,
      stageProjectionByCandidateId,
    )

    if (projectedCandidate !== candidate) {
      hasChanged = true
    }

    return projectedCandidate
  })

  return hasChanged ? projectedCandidates : candidates
}
