import {
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

import {
  useCandidateMovementCoordinator,
  useCandidateMovementSnapshot,
} from '../movement/CandidateMovementContext'
import type {
  CandidateMoveFailure,
  CandidateMoveVerificationResolution,
  CandidateMoveVerificationRequired,
  CandidateUndoResolution,
  CandidateUndoState,
  CandidateUndoSubmission,
} from '../movement/CandidateMovementCoordinator'

export type CandidateStageMoveFailure = CandidateMoveFailure
export type CandidateStageMoveVerificationRequired =
  CandidateMoveVerificationRequired
export type CandidateStageMoveVerificationResolution =
  CandidateMoveVerificationResolution
export type CandidateStageUndoResolution = CandidateUndoResolution
export type CandidateStageUndoState = CandidateUndoState
export type CandidateStageUndoSubmission = CandidateUndoSubmission

export function useCandidateStageMove() {
  const coordinator = useCandidateMovementCoordinator()
  const snapshot = useCandidateMovementSnapshot()

  function moveCandidate(candidate: Candidate, targetStage: CandidateStage) {
    return coordinator.submit({
      candidateId: candidate.id,
      candidateName: candidate.name,
      targetStage,
    })
  }

  return {
    moveCandidate,
    pendingCandidateIds: snapshot.pendingCandidateIds,
    retryCandidate: (candidateId: CandidateId) =>
      coordinator.retry(candidateId),
    stageMoveFailureByCandidateId: snapshot.failureByCandidateId,
    stageMoveVerificationByCandidateId:
      snapshot.verificationRequiredByCandidateId,
    stageProjectionByCandidateId: snapshot.stageProjectionByCandidateId,
    undoLatest: coordinator.undoLatest,
    undoPendingCandidateIds: snapshot.undoPendingCandidateIds,
    undoState: snapshot.undoState,
    verificationPendingCandidateIds: snapshot.verificationPendingCandidateIds,
    verifyCandidate: coordinator.verify,
  }
}
