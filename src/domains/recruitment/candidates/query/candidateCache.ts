import type { QueryClient } from '@tanstack/react-query'

import type {
  Candidate,
  CandidateDetailResponse,
  CandidateListResponse,
} from '../model'
import { candidateQueryKeys } from './candidateQueryOptions'

function mergeCandidateInList(
  response: CandidateListResponse | undefined,
  incomingCandidate: Candidate,
) {
  if (response === undefined) {
    return undefined
  }

  const candidateIndex = response.data.findIndex(
    ({ id }) => id === incomingCandidate.id,
  )

  if (candidateIndex < 0) {
    return response
  }

  const currentCandidate = response.data[candidateIndex]

  if (
    currentCandidate === undefined ||
    incomingCandidate.revision <= currentCandidate.revision
  ) {
    return response
  }

  const data = [...response.data]
  data[candidateIndex] = incomingCandidate

  return { ...response, data }
}

export function mergeConfirmedCandidateInCache(
  queryClient: QueryClient,
  incomingCandidate: Candidate,
) {
  queryClient.setQueriesData<CandidateListResponse>(
    { queryKey: candidateQueryKeys.lists() },
    (response) => mergeCandidateInList(response, incomingCandidate),
  )

  queryClient.setQueryData<CandidateDetailResponse>(
    candidateQueryKeys.detail(incomingCandidate.id),
    (response) => {
      if (
        response === undefined ||
        incomingCandidate.revision <= response.data.revision
      ) {
        return response
      }

      return { data: incomingCandidate }
    },
  )
}
