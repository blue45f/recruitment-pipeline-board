// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { Candidate, CandidateStage } from '../../model'
import {
  CANDIDATE_MOCK_RECEIPT_LIMIT,
  CANDIDATE_MOCK_RECEIPT_TTL_MS,
  createCandidateMockRepository,
  createMemoryCandidateMockStorage,
  type CandidateMockStorage,
} from './index'

const FIXED_NOW = '2026-08-26T07:00:00.000Z'

function stageCommitInput(
  candidate: Candidate,
  overrides: Partial<{
    currentStage: CandidateStage
    expectedRevision: number
    clientMutationId: string
    requestId: string
    stageChangedAt: string
    committedAt: string
  }> = {},
) {
  return {
    candidateId: candidate.id,
    currentStage: 'interview' as const,
    expectedRevision: candidate.revision,
    clientMutationId: 'mutation-repository',
    requestId: 'request-repository',
    stageChangedAt: FIXED_NOW,
    committedAt: FIXED_NOW,
    ...overrides,
  }
}

describe('candidate mock repository idempotency', () => {
  it('공유 저장소의 exclusive commit은 같은 revision 변경을 하나만 반영한다', async () => {
    const storage = createMemoryCandidateMockStorage()
    const firstRepository = createCandidateMockRepository({ storage })
    const secondRepository = createCandidateMockRepository({ storage })
    const candidate = firstRepository.list(200)[0]

    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const [firstResult, secondResult] = await Promise.all([
      firstRepository.commitStageExclusive(
        stageCommitInput(candidate, {
          clientMutationId: 'mutation-exclusive-first',
        }),
      ),
      secondRepository.commitStageExclusive(
        stageCommitInput(candidate, {
          clientMutationId: 'mutation-exclusive-second',
          currentStage: 'hired',
        }),
      ),
    ])

    expect(firstResult.status).toBe('updated')
    expect(secondResult.status).toBe('revision-conflict')
    expect(secondRepository.getById(candidate.id)).toMatchObject({
      currentStage: 'interview',
      revision: candidate.revision + 1,
    })
  })

  it('repository를 다시 만들어도 같은 요청의 최초 candidate와 receipt를 replay한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const firstRepository = createCandidateMockRepository({ storage })
    const candidate = firstRepository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const input = stageCommitInput(candidate)
    const firstResult = firstRepository.commitStage(input)
    const reloadedRepository = createCandidateMockRepository({ storage })
    const replayResult = reloadedRepository.commitStage({
      ...input,
      requestId: 'request-replay-transport',
      stageChangedAt: '2026-08-26T07:05:00.000Z',
      committedAt: '2026-08-26T07:05:00.000Z',
    })

    expect(firstResult.status).toBe('updated')
    expect(replayResult.status).toBe('replayed')
    if (
      firstResult.status !== 'updated' ||
      replayResult.status !== 'replayed'
    ) {
      return
    }

    expect(replayResult.candidate).toEqual(firstResult.candidate)
    expect(replayResult.receipt).toEqual(firstResult.receipt)
    expect(reloadedRepository.getById(candidate.id)).toEqual(
      firstResult.candidate,
    )
  })

  it.each([
    ['다른 후보자', { useAnotherCandidate: true }],
    ['다른 단계', { currentStage: 'hired' as const }],
    ['다른 revision', { expectedRevisionOffset: 1 }],
  ])('같은 clientMutationId의 %s payload를 충돌로 구분한다', (_, change) => {
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const [candidate, anotherCandidate] = repository.list(200)
    expect(candidate).toBeDefined()
    expect(anotherCandidate).toBeDefined()
    if (candidate === undefined || anotherCandidate === undefined) return

    const input = stageCommitInput(candidate, {
      clientMutationId: 'mutation-payload-identity',
    })
    const firstResult = repository.commitStage(input)
    const conflictingCandidate =
      'useAnotherCandidate' in change ? anotherCandidate : candidate
    const conflictResult = repository.commitStage({
      ...input,
      candidateId: conflictingCandidate.id,
      currentStage:
        'currentStage' in change ? change.currentStage : input.currentStage,
      expectedRevision:
        input.expectedRevision +
        ('expectedRevisionOffset' in change
          ? change.expectedRevisionOffset
          : 0),
      requestId: 'request-payload-conflict',
      committedAt: '2026-08-26T07:01:00.000Z',
    })

    expect(firstResult.status).toBe('updated')
    expect(conflictResult.status).toBe('idempotency-conflict')
  })

  it('receipt TTL이 지나면 같은 키를 새 revision payload에 다시 사용할 수 있다', () => {
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const firstResult = repository.commitStage(
      stageCommitInput(candidate, {
        clientMutationId: 'mutation-expiring',
      }),
    )
    expect(firstResult.status).toBe('updated')
    if (firstResult.status !== 'updated') return

    const afterTtl = new Date(
      Date.parse(FIXED_NOW) + CANDIDATE_MOCK_RECEIPT_TTL_MS + 1,
    ).toISOString()
    const secondResult = repository.commitStage(
      stageCommitInput(firstResult.candidate, {
        currentStage: 'hired',
        clientMutationId: 'mutation-expiring',
        requestId: 'request-after-ttl',
        stageChangedAt: afterTtl,
        committedAt: afterTtl,
      }),
    )

    expect(secondResult.status).toBe('updated')
    if (secondResult.status !== 'updated') return
    expect(secondResult.candidate).toMatchObject({
      currentStage: 'hired',
      revision: candidate.revision + 2,
    })
  })

  it('최신 receipt를 포함해 최대 512개만 한 envelope에 저장한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidates = repository.list(1_000)
    const receiptCandidates = candidates.slice(0, CANDIDATE_MOCK_RECEIPT_LIMIT)
    const nextCandidate = candidates[CANDIDATE_MOCK_RECEIPT_LIMIT]
    expect(nextCandidate).toBeDefined()
    if (nextCandidate === undefined) return

    const mutations: Record<string, unknown> = {}
    const receipts: Record<string, unknown> = {}

    receiptCandidates.forEach((candidate, index) => {
      const updatedCandidate = {
        ...candidate,
        stageChangedAt: FIXED_NOW,
        revision: candidate.revision + 1,
      }
      const clientMutationId = `mutation-retained-${String(index).padStart(3, '0')}`

      mutations[candidate.id] = {
        currentStage: updatedCandidate.currentStage,
        stageChangedAt: updatedCandidate.stageChangedAt,
        revision: updatedCandidate.revision,
      }
      receipts[clientMutationId] = {
        clientMutationId,
        candidateId: candidate.id,
        currentStage: candidate.currentStage,
        expectedRevision: candidate.revision,
        requestId: `request-retained-${index}`,
        committedAt: FIXED_NOW,
        candidate: updatedCandidate,
      }
    })

    storage.write(
      JSON.stringify({
        version: 2,
        seed: 20260826,
        mutations,
        receipts,
      }),
    )

    const result = repository.commitStage(
      stageCommitInput(nextCandidate, {
        currentStage: nextCandidate.currentStage,
        clientMutationId: 'mutation-newest',
        requestId: 'request-newest',
        committedAt: '2026-08-26T07:01:00.000Z',
        stageChangedAt: '2026-08-26T07:01:00.000Z',
      }),
    )
    const persisted = JSON.parse(storage.read() ?? '{}') as {
      receipts: Record<string, unknown>
    }

    expect(result.status).toBe('updated')
    expect(Object.keys(persisted.receipts)).toHaveLength(
      CANDIDATE_MOCK_RECEIPT_LIMIT,
    )
    expect(persisted.receipts).toHaveProperty('mutation-newest')
  })

  it('저장 실패 시 candidate와 receipt를 모두 남기지 않는다', () => {
    const memoryStorage = createMemoryCandidateMockStorage()
    const failingStorage: CandidateMockStorage = {
      read: memoryStorage.read,
      remove: memoryStorage.remove,
      runExclusive: memoryStorage.runExclusive,
      write: () => {
        throw new Error('storage unavailable')
      },
    }
    const repository = createCandidateMockRepository({
      storage: failingStorage,
    })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return

    const input = stageCommitInput(candidate, {
      clientMutationId: 'mutation-atomic-write',
    })

    expect(() => repository.commitStage(input)).toThrow('storage unavailable')
    expect(memoryStorage.read()).toBeNull()
    expect(repository.getById(candidate.id)).toEqual(candidate)
    expect(
      repository.lookupStageReceipt({
        candidateId: candidate.id,
        currentStage: input.currentStage,
        expectedRevision: input.expectedRevision,
        clientMutationId: input.clientMutationId,
        checkedAt: input.committedAt,
      }),
    ).toEqual({ status: 'none' })
  })

  it('유효한 v1 mutation을 보존하고 다음 commit에서 v2 receipt를 함께 저장한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const initialRepository = createCandidateMockRepository({ storage })
    const [legacyCandidate, nextCandidate] = initialRepository.list(200)
    expect(legacyCandidate).toBeDefined()
    expect(nextCandidate).toBeDefined()
    if (legacyCandidate === undefined || nextCandidate === undefined) return

    const legacyMutation = {
      currentStage: 'hired' as const,
      stageChangedAt: FIXED_NOW,
      revision: legacyCandidate.revision + 1,
    }
    storage.write(
      JSON.stringify({
        version: 1,
        seed: 20260826,
        mutations: { [legacyCandidate.id]: legacyMutation },
      }),
    )

    const migratedRepository = createCandidateMockRepository({ storage })
    expect(migratedRepository.getById(legacyCandidate.id)).toEqual({
      ...legacyCandidate,
      ...legacyMutation,
    })

    const commitResult = migratedRepository.commitStage(
      stageCommitInput(nextCandidate, {
        clientMutationId: 'mutation-after-v1',
      }),
    )
    const persisted = JSON.parse(storage.read() ?? '{}') as {
      version: number
      mutations: Record<string, unknown>
      receipts: Record<string, unknown>
    }

    expect(commitResult.status).toBe('updated')
    expect(persisted.version).toBe(2)
    expect(persisted.mutations).toHaveProperty(legacyCandidate.id)
    expect(persisted.mutations).toHaveProperty(nextCandidate.id)
    expect(persisted.receipts).toHaveProperty('mutation-after-v1')
  })

  it.each([
    ['잘못된 seed', { version: 1, seed: 1, mutations: {} }],
    ['손상된 v1 mutation', { version: 1, seed: 20260826, mutations: [] }],
  ])('%s envelope은 빈 상태로 안전하게 초기화한다', (_, envelope) => {
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(JSON.stringify(envelope)),
    })

    expect(repository.list(200)).toHaveLength(200)
  })
})
