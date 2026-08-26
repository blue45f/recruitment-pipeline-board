import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type {
  Candidate,
  CandidateDetailResponse,
  CandidateListResponse,
} from '../model'
import { mergeConfirmedCandidateInCache } from './candidateCache'
import { candidateQueryKeys } from './candidateQueryOptions'
import {
  reconcileCandidateDetailResponse,
  reconcileCandidateListResponse,
} from './candidateStructuralSharing'

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
  it('응답 병합 시 후보자별 높은 revision과 변경 없는 응답의 identity를 보존한다', () => {
    const queryClient = new QueryClient()
    const latestCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 2,
    }
    const currentListResponse = listResponse([latestCandidate, otherCandidate])
    const reconciledListResponse = reconcileCandidateListResponse(
      queryClient,
      currentListResponse,
      listResponse([
        { ...candidate, currentStage: 'offer_discussion', revision: 1 },
        { ...otherCandidate, currentStage: 'interview', revision: 1 },
      ]),
    )
    const unchangedListResponse = reconcileCandidateListResponse(
      queryClient,
      currentListResponse,
      listResponse([{ ...latestCandidate }, { ...otherCandidate }]),
    )
    const currentDetailResponse: CandidateDetailResponse = {
      data: latestCandidate,
    }

    expect(reconciledListResponse).not.toBe(currentListResponse)
    expect(reconciledListResponse.data[0]).toBe(latestCandidate)
    expect(reconciledListResponse.data[1]).toEqual({
      ...otherCandidate,
      currentStage: 'interview',
      revision: 1,
    })
    expect(reconciledListResponse.meta).toBe(currentListResponse.meta)
    expect(unchangedListResponse).toBe(currentListResponse)
    expect(
      reconcileCandidateDetailResponse(queryClient, currentDetailResponse, {
        data: { ...latestCandidate, currentStage: 'rejected' },
      }),
    ).toBe(currentDetailResponse)
  })

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

  it('로드된 목록과 상세 중 최고 revision을 canonical로 골라 모든 기존 캐시에 전파한다', () => {
    const queryClient = new QueryClient()
    const olderListCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 4,
    }
    const detailCandidate: Candidate = {
      ...candidate,
      currentStage: 'offer_discussion',
      revision: 5,
    }
    const latestListCandidate: Candidate = {
      ...candidate,
      currentStage: 'hired',
      revision: 7,
    }
    const list200Response = listResponse([olderListCandidate, otherCandidate])
    const list1000Response = listResponse([otherCandidate, latestListCandidate])
    queryClient.setQueryData(candidateQueryKeys.list(200), list200Response)
    queryClient.setQueryData(candidateQueryKeys.list(1_000), list1000Response)
    queryClient.setQueryData<CandidateDetailResponse>(
      candidateQueryKeys.detail(candidate.id),
      { data: detailCandidate },
    )

    mergeConfirmedCandidateInCache(queryClient, {
      ...candidate,
      currentStage: 'rejected',
      revision: 6,
    })
    mergeConfirmedCandidateInCache(queryClient, {
      ...candidate,
      currentStage: 'rejected',
      revision: 7,
    })

    const updatedList200 = queryClient.getQueryData<CandidateListResponse>(
      candidateQueryKeys.list(200),
    )
    const updatedList1000 = queryClient.getQueryData<CandidateListResponse>(
      candidateQueryKeys.list(1_000),
    )
    const updatedDetail = queryClient.getQueryData<CandidateDetailResponse>(
      candidateQueryKeys.detail(candidate.id),
    )

    expect(updatedList200?.data[0]).toEqual(latestListCandidate)
    expect(updatedList1000?.data[1]).toEqual(latestListCandidate)
    expect(updatedDetail?.data).toEqual(latestListCandidate)
    expect(updatedList1000).toBe(list1000Response)
    expect(queryClient.getQueryData(candidateQueryKeys.list(0))).toBeUndefined()
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
