// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  candidateListResponseSchema,
  candidateStageUpdateResponseSchema,
  type Candidate,
  type CandidateStage,
} from '../../model'
import {
  CANDIDATE_MOCK_FAILURE_RATE,
  CANDIDATE_MOCK_LATENCY,
  createCandidateHandlers,
  createCandidateMockRepository,
  createMemoryCandidateMockStorage,
  latencyFromRandom,
  shouldSimulateFailure,
  type CandidateMockStorage,
} from './index'
import { server } from '@/mocks/server'

const API_ORIGIN = 'http://mock.test'
const FIXED_NOW = new Date('2026-08-26T07:00:00.000Z')

type TestApiOptions = {
  storage?: CandidateMockStorage
  wait?: (milliseconds: number) => Promise<void>
  shouldFail?: () => boolean
}

function installTestApi({
  storage = createMemoryCandidateMockStorage(),
  wait = async () => undefined,
  shouldFail = () => false,
}: TestApiOptions = {}) {
  const repository = createCandidateMockRepository({ storage })
  let requestSequence = 0

  server.use(
    ...createCandidateHandlers({
      repository,
      wait,
      latency: () => 0,
      shouldFail,
      now: () => FIXED_NOW,
      createRequestId: () => {
        requestSequence += 1
        return `request-${requestSequence}`
      },
    }),
  )

  return { repository, storage }
}

async function requestList(query: string) {
  return fetch(`${API_ORIGIN}/api/candidates${query}`)
}

async function requestStageUpdate(
  candidate: Candidate,
  stage: CandidateStage,
  clientMutationId: string,
) {
  return fetch(`${API_ORIGIN}/api/candidates/${candidate.id}/stage`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      stage,
      expectedRevision: candidate.revision,
      clientMutationId,
    }),
  })
}

describe('candidate mock API', () => {
  it.each([
    ['?size=0', 0],
    ['?size=200', 200],
    ['?size=1000', 1_000],
  ] as const)('%s 목록을 계약에 맞게 반환한다', async (query, size) => {
    installTestApi()

    const response = await requestList(query)
    const body: unknown = await response.json()
    const parsed = candidateListResponseSchema.parse(body)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('request-1')
    expect(parsed.data).toHaveLength(size)
    expect(parsed.meta.total).toBe(size)
  })

  it.each([
    '',
    '?size=',
    '?size=100',
    '?size=0200',
    '?size=200.0',
    '?size=200&size=1000',
  ])('잘못된 목록 query %s를 400으로 거부한다', async (query) => {
    installTestApi()

    const response = await requestList(query)
    const body = (await response.json()) as {
      error: { code: string; retryable: boolean }
    }

    expect(response.status).toBe(400)
    expect(body.error).toMatchObject({
      code: 'INVALID_REQUEST',
      retryable: false,
    })
  })

  it('존재하지 않는 후보자 상세를 404로 반환한다', async () => {
    installTestApi()

    const response = await fetch(
      `${API_ORIGIN}/api/candidates/candidate-not-found`,
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CANDIDATE_NOT_FOUND', retryable: false },
    })
  })

  it('단계 변경을 저장하고 새 repository에서도 복원한다', async () => {
    const { repository, storage } = installTestApi()
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const response = await requestStageUpdate(
      candidate,
      'offer_discussion',
      'mutation-persist',
    )
    const parsed = candidateStageUpdateResponseSchema.parse(
      await response.json(),
    )

    expect(response.status).toBe(200)
    expect(parsed.data).toMatchObject({
      id: candidate.id,
      currentStage: 'offer_discussion',
      revision: candidate.revision + 1,
    })
    expect(parsed.meta).toEqual({
      requestId: 'request-1',
      clientMutationId: 'mutation-persist',
    })

    const reloadedRepository = createCandidateMockRepository({ storage })
    expect(reloadedRepository.getById(candidate.id)).toEqual(parsed.data)
    expect(reloadedRepository.list(0)).toEqual([])
    expect(reloadedRepository.getById(candidate.id)).toEqual(parsed.data)
  })

  it('동일 revision의 병렬 PATCH 중 하나만 성공시킨다', async () => {
    let waitingCount = 0
    let releaseGate: (() => void) | undefined
    let resolveBothWaiting: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })
    const bothWaiting = new Promise<void>((resolve) => {
      resolveBothWaiting = resolve
    })
    const { repository } = installTestApi({
      wait: async () => {
        waitingCount += 1
        if (waitingCount === 2) resolveBothWaiting?.()
        await gate
      },
    })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const firstRequest = requestStageUpdate(
      candidate,
      'interview',
      'mutation-race-1',
    )
    const secondRequest = requestStageUpdate(
      candidate,
      'hired',
      'mutation-race-2',
    )

    await bothWaiting
    releaseGate?.()

    const responses = await Promise.all([firstRequest, secondRequest])
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])

    const winner = responses.find(({ status }) => status === 200)
    expect(winner).toBeDefined()
    if (winner === undefined) return

    const winnerBody = candidateStageUpdateResponseSchema.parse(
      await winner.json(),
    )
    expect(repository.getById(candidate.id)).toEqual(winnerBody.data)
    expect(winnerBody.data.revision).toBe(candidate.revision + 1)
  })

  it('같은 storage를 공유하는 repository도 fresh revision으로 CAS한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const firstRepository = createCandidateMockRepository({ storage })
    const secondRepository = createCandidateMockRepository({ storage })
    const candidate = firstRepository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const firstResult = firstRepository.commitStage({
      candidateId: candidate.id,
      currentStage: 'interview',
      expectedRevision: candidate.revision,
      stageChangedAt: FIXED_NOW.toISOString(),
    })
    const secondResult = secondRepository.commitStage({
      candidateId: candidate.id,
      currentStage: 'rejected',
      expectedRevision: candidate.revision,
      stageChangedAt: FIXED_NOW.toISOString(),
    })

    expect(firstResult.status).toBe('updated')
    expect(secondResult.status).toBe('conflict')
  })

  it('강제 503 실패 뒤 단계와 revision을 변경하지 않는다', async () => {
    const { repository } = installTestApi({ shouldFail: () => true })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const response = await requestStageUpdate(
      candidate,
      'rejected',
      'mutation-failure',
    )

    expect(response.status).toBe(503)
    expect(repository.getById(candidate.id)).toEqual(candidate)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SIMULATED_FAILURE', retryable: true },
    })
  })

  it('storage write 실패 뒤에도 변경을 남기지 않는다', async () => {
    const memoryStorage = createMemoryCandidateMockStorage()
    const failingStorage: CandidateMockStorage = {
      read: memoryStorage.read,
      remove: memoryStorage.remove,
      write: () => {
        throw new Error('storage unavailable')
      },
    }
    const { repository } = installTestApi({ storage: failingStorage })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const response = await requestStageUpdate(
      candidate,
      'rejected',
      'mutation-storage-failure',
    )

    expect(response.status).toBe(503)
    expect(repository.getById(candidate.id)).toEqual(candidate)
  })

  it('storage read 실패를 구조화된 503으로 반환한다', async () => {
    const failingStorage: CandidateMockStorage = {
      read: () => {
        throw new Error('storage unavailable')
      },
      remove: () => undefined,
      write: () => undefined,
    }
    installTestApi({ storage: failingStorage })

    const response = await requestList('?size=200')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PERSISTENCE_FAILURE', retryable: true },
    })
  })

  it('형식은 맞지만 후보자 계약을 깨는 overlay를 무시한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const initialRepository = createCandidateMockRepository({ storage })
    const candidate = initialRepository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    storage.write(
      JSON.stringify({
        version: 1,
        seed: 20260826,
        mutations: {
          [candidate.id]: {
            currentStage: 'hired',
            stageChangedAt: '2000-01-01T00:00:00.000Z',
            revision: candidate.revision + 1,
          },
        },
      }),
    )

    const reloadedRepository = createCandidateMockRepository({ storage })
    expect(reloadedRepository.getById(candidate.id)).toEqual(candidate)
  })

  it.each(['not-json', JSON.stringify({ version: 0, mutations: {} })])(
    '손상되거나 이전 버전인 저장값을 안전하게 무시한다',
    (storedValue) => {
      const repository = createCandidateMockRepository({
        storage: createMemoryCandidateMockStorage(storedValue),
      })

      expect(repository.list(200)).toHaveLength(200)
    },
  )

  it('기본 지연 범위와 실패율 경계를 고정한다', () => {
    expect(CANDIDATE_MOCK_LATENCY).toEqual({ min: 200, max: 800 })
    expect(latencyFromRandom(0)).toBe(200)
    expect(latencyFromRandom(1)).toBe(800)
    expect(CANDIDATE_MOCK_FAILURE_RATE).toBe(0.15)
    expect(shouldSimulateFailure(0.149_999)).toBe(true)
    expect(shouldSimulateFailure(0.15)).toBe(false)
  })
})
