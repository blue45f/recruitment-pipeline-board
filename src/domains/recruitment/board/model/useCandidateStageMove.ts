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

export function getCandidateStageMoveErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.safeMessage
    : UNKNOWN_STAGE_MOVE_MESSAGE
}

export function useCandidateStageMove() {
  const queryClient = useQueryClient()
  const mutation = useMutation(candidateStageMutationOptions())
  const pendingCandidateIdsRef = useRef(new Set<CandidateId>())
  const [pendingCandidateIds, setPendingCandidateIds] = useState<
    ReadonlySet<CandidateId>
  >(() => new Set())

  const setCandidatePending = (candidateId: CandidateId, pending: boolean) => {
    if (pending) {
      pendingCandidateIdsRef.current.add(candidateId)
    } else {
      pendingCandidateIdsRef.current.delete(candidateId)
    }

    setPendingCandidateIds(new Set(pendingCandidateIdsRef.current))
  }

  const moveCandidate = async (candidate: Candidate, stage: CandidateStage) => {
    if (
      candidate.currentStage === stage ||
      pendingCandidateIdsRef.current.has(candidate.id)
    ) {
      return candidate
    }

    setCandidatePending(candidate.id, true)

    try {
      const response = await mutation.mutateAsync({
        candidateId: candidate.id,
        clientMutationId: crypto.randomUUID(),
        expectedRevision: candidate.revision,
        stage,
      })

      mergeConfirmedCandidateInCache(queryClient, response.data)
      toast.success(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[stage]} 단계로 이동했습니다.`,
        { duration: 8_000 },
      )

      return response.data
    } finally {
      setCandidatePending(candidate.id, false)
    }
  }

  return {
    moveCandidate,
    pendingCandidateIds,
  }
}
