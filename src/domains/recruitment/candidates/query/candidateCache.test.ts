import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type {
  Candidate,
  CandidateDetailResponse,
  CandidateListResponse,
} from '../model'
import { mergeConfirmedCandidateInCache } from './candidateCache'
import { candidateQueryKeys } from './candidateQueryOptions'

const candidate: Candidate = {
  id: 'candidate-cache-test',
  name: '김캐시',
  role: 'frontend_engineer',
  appliedAt: '2026-08-20T00:00:00.000Z',
  currentStage: 'document_review',
  email: 'cache@example.com',
  experienceYears: 5,
  memo: '후보자 캐시 테스트',
  stageChangedAt: '2026-08-20T00:00:00.000Z',
  revision: 0,
}

const otherCandidate: Candidate = {
  ...candidate,
  id: 'candidate-cache-other',
  name: '이목록',
  email: 'other@example.com',
}

function listResponse(data: Candidate[]): CandidateListResponse {
  return { data, meta: { total: data.length } }
}

describe('candidate cache', () => {
  it('더 높은 revision의 확정 후보자를 모든 목록 크기와 기존 상세 캐시에 병합한다', () => {
    const queryClient = new QueryClient()
    const updatedCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 1,
    }
    queryClient.setQueryData(
      candidateQueryKeys.list(200),
      listResponse([candidate, otherCandidate]),
    )
    queryClient.setQueryData(
      candidateQueryKeys.list(1_000),
      listResponse([otherCandidate, candidate]),
    )
    queryClient.setQueryData<CandidateDetailResponse>(
      candidateQueryKeys.detail(candidate.id),
      { data: candidate },
    )

    mergeConfirmedCandidateInCache(queryClient, updatedCandidate)

    expect(
      queryClient.getQueryData<CandidateListResponse>(
        candidateQueryKeys.list(200),
      ),
    ).toEqual(listResponse([updatedCandidate, otherCandidate]))
    expect(
      queryClient.getQueryData<CandidateListResponse>(
        candidateQueryKeys.list(1_000),
      ),
    ).toEqual(listResponse([otherCandidate, updatedCandidate]))
    expect(
      queryClient.getQueryData<CandidateDetailResponse>(
        candidateQueryKeys.detail(candidate.id),
      ),
    ).toEqual({ data: updatedCandidate })
    expect(
      queryClient.getQueryData(candidateQueryKeys.detail(otherCandidate.id)),
    ).toBeUndefined()
  })

  it('더 낮거나 같은 revision이 최신 확정 후보자를 덮지 않는다', () => {
    const queryClient = new QueryClient()
    const latestCandidate: Candidate = {
      ...candidate,
      currentStage: 'hired',
      revision: 3,
    }
    queryClient.setQueryData(
      candidateQueryKeys.list(200),
      listResponse([latestCandidate, otherCandidate]),
    )
    queryClient.setQueryData<CandidateDetailResponse>(
      candidateQueryKeys.detail(candidate.id),
      { data: latestCandidate },
    )

    mergeConfirmedCandidateInCache(queryClient, {
      ...candidate,
      currentStage: 'interview',
      revision: 2,
    })
    mergeConfirmedCandidateInCache(queryClient, {
      ...candidate,
      currentStage: 'rejected',
      revision: 3,
    })

    expect(
      queryClient.getQueryData<CandidateListResponse>(
        candidateQueryKeys.list(200),
      ),
    ).toEqual(listResponse([latestCandidate, otherCandidate]))
    expect(
      queryClient.getQueryData<CandidateDetailResponse>(
        candidateQueryKeys.detail(candidate.id),
      ),
    ).toEqual({ data: latestCandidate })
  })

  it('목록에 없는 후보자와 조회하지 않은 상세 캐시는 새로 만들지 않는다', () => {
    const queryClient = new QueryClient()
    const response = listResponse([otherCandidate])
    const updatedCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 1,
    }
    queryClient.setQueryData(candidateQueryKeys.list(200), response)

    mergeConfirmedCandidateInCache(queryClient, updatedCandidate)

    expect(queryClient.getQueryData(candidateQueryKeys.list(200))).toBe(
      response,
    )
    expect(
      queryClient.getQueryData(candidateQueryKeys.detail(updatedCandidate.id)),
    ).toBeUndefined()
  })

  it('변경하지 않은 후보자 객체와 목록 메타데이터를 보존한다', () => {
    const queryClient = new QueryClient()
    const response = listResponse([candidate, otherCandidate])
    const updatedCandidate: Candidate = {
      ...candidate,
      currentStage: 'offer_discussion',
      revision: 1,
    }
    queryClient.setQueryData(candidateQueryKeys.list(200), response)

    mergeConfirmedCandidateInCache(queryClient, updatedCandidate)

    const updatedResponse = queryClient.getQueryData<CandidateListResponse>(
      candidateQueryKeys.list(200),
    )

    expect(updatedResponse?.meta).toBe(response.meta)
    expect(updatedResponse?.data[1]).toBe(otherCandidate)
  })
})
