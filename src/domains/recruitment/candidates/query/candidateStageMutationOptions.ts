import { mutationOptions } from '@tanstack/react-query'

import { ApiError, createCandidateApi, type CandidateApi } from '../api'
import type {
  CandidateId,
  CandidateStage,
  CandidateStageUpdateResponse,
} from '../model'
import { candidateQueryKeys } from './candidateQueryOptions'

const STAGE_RESPONSE_SAFE_MESSAGE = '단계 변경 응답을 확인할 수 없습니다.'

export type CandidateStageMutationVariables = Readonly<{
  candidateId: CandidateId
  clientMutationId: string
  expectedRevision: number
  stage: CandidateStage
}>

function validateCorrelatedResponse(
  response: CandidateStageUpdateResponse,
  variables: CandidateStageMutationVariables,
) {
  if (
    response.data.id !== variables.candidateId ||
    response.data.currentStage !== variables.stage ||
    response.data.revision !== variables.expectedRevision + 1 ||
    response.meta.clientMutationId !== variables.clientMutationId
  ) {
    throw new ApiError({
      kind: 'schema',
      status: undefined,
      requestId: response.meta.requestId,
      retryable: false,
      safeMessage: STAGE_RESPONSE_SAFE_MESSAGE,
      cause: response,
    })
  }

  return response
}

export function candidateStageMutationOptions(
  candidateApi: CandidateApi = createCandidateApi(),
) {
  return mutationOptions({
    mutationKey: candidateQueryKeys.stageUpdates(),
    mutationFn: async (variables: CandidateStageMutationVariables) => {
      const response = await candidateApi.updateStage(
        { candidateId: variables.candidateId },
        {
          stage: variables.stage,
          expectedRevision: variables.expectedRevision,
          clientMutationId: variables.clientMutationId,
        },
      )

      return validateCorrelatedResponse(response, variables)
    },
    retry: false,
  })
}
