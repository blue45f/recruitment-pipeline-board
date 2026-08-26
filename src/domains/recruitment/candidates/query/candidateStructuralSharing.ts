import type { QueryClient } from '@tanstack/react-query'

import type {
  Candidate,
  CandidateDetailResponse,
  CandidateId,
  CandidateListResponse,
} from '../model'
import { candidateQueryKeys } from './candidateQueryKeys'

function hasSameItems<T>(left: readonly T[], right: readonly T[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  )
}

function rememberLatestCandidate(
  candidatesById: Map<CandidateId, Candidate>,
  candidate: Candidate,
) {
  const rememberedCandidate = candidatesById.get(candidate.id)

  if (
    rememberedCandidate === undefined ||
    candidate.revision > rememberedCandidate.revision
  ) {
    candidatesById.set(candidate.id, candidate)
  }
}

function indexLatestCachedCandidates(
  queryClient: QueryClient,
  currentCandidates: readonly Candidate[],
) {
  const candidatesById = new Map<CandidateId, Candidate>()

  for (const candidate of currentCandidates) {
    rememberLatestCandidate(candidatesById, candidate)
  }

  const detailResponses = queryClient.getQueriesData<CandidateDetailResponse>({
    queryKey: candidateQueryKeys.details(),
  })

  for (const [, response] of detailResponses) {
    if (response !== undefined) {
      rememberLatestCandidate(candidatesById, response.data)
    }
  }

  const listResponses = queryClient.getQueriesData<CandidateListResponse>({
    queryKey: candidateQueryKeys.lists(),
  })

  for (const [, response] of listResponses) {
    if (response === undefined) {
      continue
    }

    for (const candidate of response.data) {
      rememberLatestCandidate(candidatesById, candidate)
    }
  }

  return candidatesById
}

function preferLatestCandidate(
  cachedCandidate: Candidate | undefined,
  incomingCandidate: Candidate,
) {
  if (
    cachedCandidate !== undefined &&
    cachedCandidate.revision >= incomingCandidate.revision
  ) {
    return cachedCandidate
  }

  return incomingCandidate
}

export function reconcileCandidateListResponse(
  queryClient: QueryClient,
  currentResponse: CandidateListResponse | undefined,
  incomingResponse: CandidateListResponse,
): CandidateListResponse {
  const latestCandidatesById = indexLatestCachedCandidates(
    queryClient,
    currentResponse?.data ?? [],
  )
  const reconciledData = incomingResponse.data.map((incomingCandidate) => {
    return preferLatestCandidate(
      latestCandidatesById.get(incomingCandidate.id),
      incomingCandidate,
    )
  })
  const data = hasSameItems(reconciledData, incomingResponse.data)
    ? incomingResponse.data
    : reconciledData
  const meta =
    currentResponse !== undefined &&
    currentResponse.meta.total === incomingResponse.meta.total
      ? currentResponse.meta
      : incomingResponse.meta

  if (
    currentResponse !== undefined &&
    meta === currentResponse.meta &&
    hasSameItems(data, currentResponse.data)
  ) {
    return currentResponse
  }

  if (data === incomingResponse.data && meta === incomingResponse.meta) {
    return incomingResponse
  }

  return { ...incomingResponse, data, meta }
}

export function reconcileCandidateDetailResponse(
  queryClient: QueryClient,
  currentResponse: CandidateDetailResponse | undefined,
  incomingResponse: CandidateDetailResponse,
): CandidateDetailResponse {
  const currentCandidates =
    currentResponse?.data.id === incomingResponse.data.id
      ? [currentResponse.data]
      : []
  const latestCandidatesById = indexLatestCachedCandidates(
    queryClient,
    currentCandidates,
  )
  const reconciledCandidate = preferLatestCandidate(
    latestCandidatesById.get(incomingResponse.data.id),
    incomingResponse.data,
  )

  if (currentResponse?.data === reconciledCandidate) {
    return currentResponse
  }

  if (incomingResponse.data === reconciledCandidate) {
    return incomingResponse
  }

  return { ...incomingResponse, data: reconciledCandidate }
}
