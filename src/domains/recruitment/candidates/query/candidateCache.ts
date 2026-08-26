import type { QueryClient } from '@tanstack/react-query'

import type {
  Candidate,
  CandidateDetailResponse,
  CandidateListResponse,
} from '../model'
import { candidateQueryKeys } from './candidateQueryKeys'

function replaceCandidateInList(
  response: CandidateListResponse | undefined,
  canonicalCandidate: Candidate,
) {
  if (response === undefined) {
    return undefined
  }

  const candidateIndex = response.data.findIndex(
    ({ id }) => id === canonicalCandidate.id,
  )

  if (candidateIndex < 0) {
    return response
  }

  const currentCandidate = response.data[candidateIndex]

  if (
    currentCandidate === undefined ||
    currentCandidate === canonicalCandidate ||
    currentCandidate.revision > canonicalCandidate.revision
  ) {
    return response
  }

  const data = [...response.data]
  data[candidateIndex] = canonicalCandidate

  return { ...response, data }
}

function findCanonicalCandidate(
  queryClient: QueryClient,
  incomingCandidate: Candidate,
) {
  const detailResponse = queryClient.getQueryData<CandidateDetailResponse>(
    candidateQueryKeys.detail(incomingCandidate.id),
  )
  const loadedListResponses = queryClient.getQueriesData<CandidateListResponse>(
    {
      queryKey: candidateQueryKeys.lists(),
    },
  )
  let cachedCandidate = detailResponse?.data

  for (const [, response] of loadedListResponses) {
    const listCandidate = response?.data.find(
      ({ id }) => id === incomingCandidate.id,
    )

    if (
      listCandidate !== undefined &&
      (cachedCandidate === undefined ||
        listCandidate.revision > cachedCandidate.revision)
    ) {
      cachedCandidate = listCandidate
    }
  }

  if (
    cachedCandidate !== undefined &&
    cachedCandidate.revision >= incomingCandidate.revision
  ) {
    return cachedCandidate
  }

  return incomingCandidate
}

export function mergeConfirmedCandidateInCache(
  queryClient: QueryClient,
  incomingCandidate: Candidate,
) {
  const canonicalCandidate = findCanonicalCandidate(
    queryClient,
    incomingCandidate,
  )

  queryClient.setQueriesData<CandidateListResponse>(
    { queryKey: candidateQueryKeys.lists() },
    (response) => replaceCandidateInList(response, canonicalCandidate),
  )

  const detailQueryKey = candidateQueryKeys.detail(incomingCandidate.id)
  const detailResponse =
    queryClient.getQueryData<CandidateDetailResponse>(detailQueryKey)

  if (detailResponse === undefined) {
    return
  }

  queryClient.setQueryData<CandidateDetailResponse>(
    detailQueryKey,
    (response) => {
      if (
        response === undefined ||
        response.data === canonicalCandidate ||
        response.data.revision > canonicalCandidate.revision
      ) {
        return response
      }

      return { ...response, data: canonicalCandidate }
    },
  )
}
