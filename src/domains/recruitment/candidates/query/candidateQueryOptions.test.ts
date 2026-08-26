import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CandidateDetailResponse, CandidateListResponse } from '../model'

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
})
