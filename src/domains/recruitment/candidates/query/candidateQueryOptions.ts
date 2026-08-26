import { queryOptions } from '@tanstack/react-query'

import { createCandidateApi } from '../api'
import type { CandidateId, CandidateListSize } from '../model'

const candidateApi = createCandidateApi()

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
  })
}

export function candidateDetailQueryOptions(candidateId: CandidateId) {
  return queryOptions({
    queryKey: candidateQueryKeys.detail(candidateId),
    queryFn: ({ signal }) => candidateApi.detail({ candidateId }, { signal }),
  })
}
