import { queryOptions } from '@tanstack/react-query'

import { ApiError, createCandidateApi } from '../api'
import type { CandidateId, CandidateListSize } from '../model'

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

export const candidateQueryKeys = {
  all: ['recruitment', 'candidates'] as const,
  details: () => [...candidateQueryKeys.all, 'detail'] as const,
  detail: (candidateId: CandidateId) =>
    [...candidateQueryKeys.details(), candidateId] as const,
  lists: () => [...candidateQueryKeys.all, 'list'] as const,
  list: (size: CandidateListSize) =>
    [...candidateQueryKeys.lists(), size] as const,
}

export function candidateListQueryOptions(size: CandidateListSize) {
  return queryOptions({
    queryKey: candidateQueryKeys.list(size),
    queryFn: ({ signal }) => candidateApi.list({ size }, { signal }),
    retry: shouldRetryCandidateQuery,
  })
}

export function candidateDetailQueryOptions(candidateId: CandidateId) {
  return queryOptions({
    queryKey: candidateQueryKeys.detail(candidateId),
    queryFn: ({ signal }) => candidateApi.detail({ candidateId }, { signal }),
    retry: shouldRetryCandidateQuery,
  })
}
