import { queryOptions } from '@tanstack/react-query'

import { ApiError, createCandidateApi } from '../api'
import type {
  CandidateDetailResponse,
  CandidateId,
  CandidateListResponse,
  CandidateListSize,
} from '../model'
import { candidateQueryKeys } from './candidateQueryKeys'
import {
  reconcileCandidateDetailResponse,
  reconcileCandidateListResponse,
} from './candidateStructuralSharing'

const candidateApi = createCandidateApi()

function shouldRetryCandidateQuery(failureCount: number, error: unknown) {
  return (
    failureCount < 1 &&
    error instanceof ApiError &&
    error.retryable &&
    error.kind !== 'schema' &&
    error.status !== 404
  )
}

export function candidateListQueryOptions(size: CandidateListSize) {
  return queryOptions({
    queryKey: candidateQueryKeys.list(size),
    queryFn: async ({ client, queryKey, signal }) => {
      const incomingResponse = await candidateApi.list({ size }, { signal })

      return reconcileCandidateListResponse(
        client,
        client.getQueryData<CandidateListResponse>(queryKey),
        incomingResponse,
      )
    },
    retry: shouldRetryCandidateQuery,
  })
}

export function candidateDetailQueryOptions(candidateId: CandidateId) {
  return queryOptions({
    queryKey: candidateQueryKeys.detail(candidateId),
    queryFn: async ({ client, queryKey, signal }) => {
      const incomingResponse = await candidateApi.detail(
        { candidateId },
        { signal },
      )

      return reconcileCandidateDetailResponse(
        client,
        client.getQueryData<CandidateDetailResponse>(queryKey),
        incomingResponse,
      )
    },
    retry: shouldRetryCandidateQuery,
  })
}

export { candidateQueryKeys } from './candidateQueryKeys'
