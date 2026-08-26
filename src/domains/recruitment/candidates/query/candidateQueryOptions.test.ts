import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Candidate,
  CandidateDetailResponse,
  CandidateListResponse,
} from '../model'

const apiMocks = vi.hoisted(() => ({
  create: vi.fn(),
  detail: vi.fn(),
  list: vi.fn(),
  updateStage: vi.fn(),
}))

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  createCandidateApi: apiMocks.create.mockReturnValue({
    detail: apiMocks.detail,
    list: apiMocks.list,
    updateStage: apiMocks.updateStage,
  }),
}))

import { mergeConfirmedCandidateInCache } from './candidateCache'
import {
  candidateDetailQueryOptions,
  candidateListQueryOptions,
  candidateQueryKeys,
} from './candidateQueryOptions'

const candidate = {
  id: 'candidate-query-test',
  name: '김조회',
  role: 'frontend_engineer' as const,
  appliedAt: '2026-08-20T00:00:00.000Z',
  currentStage: 'document_review' as const,
  email: 'query@example.com',
  experienceYears: 5,
  memo: '조회 계층 테스트 후보자',
  stageChangedAt: '2026-08-20T00:00:00.000Z',
  revision: 0,
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  })
}

function createDeferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

describe('candidate query options', () => {
  beforeEach(() => {
    apiMocks.detail.mockReset()
    apiMocks.list.mockReset()
  })

  it('크기와 후보자 식별자를 안정적인 계층형 키로 만든다', () => {
    expect(candidateQueryKeys.list(200)).toEqual([
      'recruitment',
      'candidates',
      'list',
      200,
    ])
    expect(candidateQueryKeys.detail(candidate.id)).toEqual([
      'recruitment',
      'candidates',
      'detail',
      candidate.id,
    ])
  })

  it('목록을 한 번만 요청하고 QueryClient의 signal을 API로 전달한다', async () => {
    const response: CandidateListResponse = {
      data: [candidate],
      meta: { total: 1 },
    }
    let receivedSignal: AbortSignal | undefined
    apiMocks.list.mockImplementation(
      async (_input: unknown, options: { signal?: AbortSignal }) => {
        receivedSignal = options.signal
        return response
      },
    )
    const client = createTestQueryClient()

    await expect(
      client.fetchQuery(candidateListQueryOptions(200)),
    ).resolves.toEqual(response)

    expect(apiMocks.list).toHaveBeenCalledExactlyOnceWith(
      { size: 200 },
      { signal: receivedSignal },
    )
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
    client.clear()
  })

  it('늦게 완료된 목록 GET이 캐시의 더 높은 후보자 revision을 덮지 않는다', async () => {
    const deferredResponse = createDeferred<CandidateListResponse>()
    const staleCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 1,
    }
    const latestCandidate: Candidate = {
      ...candidate,
      currentStage: 'hired',
      revision: 2,
    }
    const latestResponse: CandidateListResponse = {
      data: [latestCandidate],
      meta: { total: 1 },
    }
    const staleResponse: CandidateListResponse = {
      data: [staleCandidate],
      meta: { total: 1 },
    }
    apiMocks.list.mockReturnValue(deferredResponse.promise)
    const client = createTestQueryClient()
    const request = client.fetchQuery(candidateListQueryOptions(200))

    await vi.waitFor(() => expect(apiMocks.list).toHaveBeenCalledOnce())
    client.setQueryData(candidateQueryKeys.list(200), latestResponse)
    deferredResponse.resolve(staleResponse)

    await request
    expect(
      client.getQueryData<CandidateListResponse>(candidateQueryKeys.list(200)),
    ).toBe(latestResponse)
    client.clear()
  })

  it('상세 prefetch와 후속 조회가 동일한 옵션과 캐시를 재사용한다', async () => {
    const response: CandidateDetailResponse = { data: candidate }
    let receivedSignal: AbortSignal | undefined
    apiMocks.detail.mockImplementation(
      async (_input: unknown, options: { signal?: AbortSignal }) => {
        receivedSignal = options.signal
        return response
      },
    )
    const client = createTestQueryClient()
    const prefetchedOptions = candidateDetailQueryOptions(candidate.id)

    await client.prefetchQuery(prefetchedOptions)
    await expect(
      client.fetchQuery(candidateDetailQueryOptions(candidate.id)),
    ).resolves.toEqual(response)

    expect(apiMocks.detail).toHaveBeenCalledExactlyOnceWith(
      { candidateId: candidate.id },
      { signal: receivedSignal },
    )
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
    client.clear()
  })

  it('늦게 완료된 상세 GET이 캐시의 더 높은 후보자 revision을 덮지 않는다', async () => {
    const deferredResponse = createDeferred<CandidateDetailResponse>()
    const staleCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 1,
    }
    const latestCandidate: Candidate = {
      ...candidate,
      currentStage: 'hired',
      revision: 2,
    }
    const latestResponse: CandidateDetailResponse = { data: latestCandidate }
    const staleResponse: CandidateDetailResponse = { data: staleCandidate }
    apiMocks.detail.mockReturnValue(deferredResponse.promise)
    const client = createTestQueryClient()
    const request = client.fetchQuery(candidateDetailQueryOptions(candidate.id))

    await vi.waitFor(() => expect(apiMocks.detail).toHaveBeenCalledOnce())
    client.setQueryData(candidateQueryKeys.detail(candidate.id), latestResponse)
    deferredResponse.resolve(staleResponse)

    await request
    expect(
      client.getQueryData<CandidateDetailResponse>(
        candidateQueryKeys.detail(candidate.id),
      ),
    ).toBe(latestResponse)
    client.clear()
  })

  it('비어 있던 목록과 상세의 후발 GET도 다른 캐시의 확정 revision을 유지한다', async () => {
    const deferredListResponse = createDeferred<CandidateListResponse>()
    const deferredDetailResponse = createDeferred<CandidateDetailResponse>()
    const confirmedCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 1,
    }
    const staleListResponse: CandidateListResponse = {
      data: [candidate],
      meta: { total: 1 },
    }
    const staleDetailResponse: CandidateDetailResponse = { data: candidate }
    apiMocks.list.mockReturnValue(deferredListResponse.promise)
    apiMocks.detail.mockReturnValue(deferredDetailResponse.promise)
    const client = createTestQueryClient()
    client.setQueryData(candidateQueryKeys.list(200), staleListResponse)
    const listRequest = client.fetchQuery(candidateListQueryOptions(1_000))
    const detailRequest = client.fetchQuery(
      candidateDetailQueryOptions(candidate.id),
    )

    await vi.waitFor(() => {
      expect(apiMocks.list).toHaveBeenCalledOnce()
      expect(apiMocks.detail).toHaveBeenCalledOnce()
    })
    mergeConfirmedCandidateInCache(client, confirmedCandidate)
    const confirmedListResponse = client.getQueryData<CandidateListResponse>(
      candidateQueryKeys.list(200),
    )
    deferredListResponse.resolve(staleListResponse)
    deferredDetailResponse.resolve(staleDetailResponse)

    await Promise.all([listRequest, detailRequest])

    const loadedList = client.getQueryData<CandidateListResponse>(
      candidateQueryKeys.list(1_000),
    )
    const loadedDetail = client.getQueryData<CandidateDetailResponse>(
      candidateQueryKeys.detail(candidate.id),
    )
    const cachedConfirmedCandidate = confirmedListResponse?.data[0]

    expect(cachedConfirmedCandidate).toEqual(confirmedCandidate)
    expect(loadedList?.data[0]).toBe(cachedConfirmedCandidate)
    expect(loadedDetail?.data).toBe(cachedConfirmedCandidate)
    expect(
      client.getQueryData<CandidateListResponse>(candidateQueryKeys.list(200)),
    ).toBe(confirmedListResponse)
    client.clear()
  })
})
