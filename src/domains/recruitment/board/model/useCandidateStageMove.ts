import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ApiError } from '@/domains/recruitment/candidates/api'
import {
  CANDIDATE_STAGE_LABELS,
  type Candidate,
  type CandidateId,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'
import {
  candidateStageMutationOptions,
  mergeConfirmedCandidateInCache,
} from '@/domains/recruitment/candidates/query'

const UNKNOWN_STAGE_MOVE_MESSAGE = '단계 변경을 저장하지 못했습니다.'

type PendingStageMove = Readonly<{
  clientMutationId: string
  stage: CandidateStage
}>

export type CandidateStageMoveFailure = Readonly<{
  candidate: Candidate
  message: string
  targetStage: CandidateStage
}>

export function getCandidateStageMoveErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.safeMessage
    : UNKNOWN_STAGE_MOVE_MESSAGE
}

export function useCandidateStageMove() {
  const queryClient = useQueryClient()
  const mutation = useMutation(candidateStageMutationOptions())
  const pendingMovesRef = useRef(new Map<CandidateId, PendingStageMove>())
  const [pendingCandidateIds, setPendingCandidateIds] = useState<
    ReadonlySet<CandidateId>
  >(() => new Set())
  const [stageProjectionByCandidateId, setStageProjectionByCandidateId] =
    useState<ReadonlyMap<CandidateId, CandidateStage>>(() => new Map())
  const [stageMoveFailureByCandidateId, setStageMoveFailureByCandidateId] =
    useState<ReadonlyMap<CandidateId, CandidateStageMoveFailure>>(
      () => new Map(),
    )

  const publishPendingMoves = () => {
    setPendingCandidateIds(new Set(pendingMovesRef.current.keys()))
    setStageProjectionByCandidateId(
      new Map(
        Array.from(pendingMovesRef.current, ([candidateId, operation]) => [
          candidateId,
          operation.stage,
        ]),
      ),
    )
  }

  function moveCandidate(candidate: Candidate, stage: CandidateStage) {
    if (
      candidate.currentStage === stage ||
      pendingMovesRef.current.has(candidate.id)
    ) {
      return
    }

    const operation: PendingStageMove = {
      clientMutationId: crypto.randomUUID(),
      stage,
    }

    setStageMoveFailureByCandidateId((currentFailures) => {
      if (!currentFailures.has(candidate.id)) {
        return currentFailures
      }

      const nextFailures = new Map(currentFailures)

      nextFailures.delete(candidate.id)

      return nextFailures
    })
    pendingMovesRef.current.set(candidate.id, operation)
    publishPendingMoves()

    void (async () => {
      try {
        const response = await mutation.mutateAsync({
          candidateId: candidate.id,
          clientMutationId: operation.clientMutationId,
          expectedRevision: candidate.revision,
          stage,
        })

        mergeConfirmedCandidateInCache(queryClient, response.data)
        toast.success(
          `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[stage]} 단계로 이동했습니다.`,
          { duration: 8_000 },
        )
      } catch (error) {
        setStageMoveFailureByCandidateId((currentFailures) => {
          const nextFailures = new Map(currentFailures)

          nextFailures.set(candidate.id, {
            candidate,
            message: getCandidateStageMoveErrorMessage(error),
            targetStage: stage,
          })

          return nextFailures
        })
      } finally {
        if (
          pendingMovesRef.current.get(candidate.id)?.clientMutationId ===
          operation.clientMutationId
        ) {
          pendingMovesRef.current.delete(candidate.id)
          publishPendingMoves()
        }
      }
    })()
  }

  return {
    moveCandidate,
    pendingCandidateIds,
    stageMoveFailureByCandidateId,
    stageProjectionByCandidateId,
  }
}
