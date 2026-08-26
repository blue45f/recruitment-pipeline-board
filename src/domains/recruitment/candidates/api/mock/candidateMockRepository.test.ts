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
    compensatesClientMutationId: string
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

  it('정상 commit에 lock 내부 previousStage와 move operation kind를 기록한다', () => {
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)

    const result = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-with-undo-receipt',
      }),
    )

    expect(result.status).toBe('updated')
    if (result.status !== 'updated') return
    expect(result.receipt).toMatchObject({
      operationKind: 'move',
      previousStage: candidate.currentStage,
      currentStage: targetStage,
      expectedRevision: candidate.revision,
    })
  })

  it('move receipt를 정확히 한 번 보상하고 같은 compensation ID는 replay한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-before-compensation',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return

    const compensationInput = stageCommitInput(moveResult.candidate, {
      currentStage: candidate.currentStage,
      clientMutationId: 'mutation-compensation',
      compensatesClientMutationId: moveResult.receipt.clientMutationId,
      requestId: 'request-compensation',
      stageChangedAt: '2026-08-26T07:01:00.000Z',
      committedAt: '2026-08-26T07:01:00.000Z',
    })
    const compensationResult = repository.commitStage(compensationInput)
    const replayResult = createCandidateMockRepository({ storage }).commitStage(
      {
        ...compensationInput,
        requestId: 'request-compensation-replay',
        stageChangedAt: '2026-08-26T07:02:00.000Z',
        committedAt: '2026-08-26T07:02:00.000Z',
      },
    )

    expect(compensationResult.status).toBe('updated')
    expect(replayResult.status).toBe('replayed')
    if (
      compensationResult.status !== 'updated' ||
      replayResult.status !== 'replayed'
    ) {
      return
    }
    expect(compensationResult.candidate).toMatchObject({
      currentStage: candidate.currentStage,
      revision: candidate.revision + 2,
    })
    expect(compensationResult.receipt).toMatchObject({
      operationKind: 'compensation',
      previousStage: targetStage,
      compensatesClientMutationId: moveResult.receipt.clientMutationId,
    })
    expect(replayResult.receipt).toEqual(compensationResult.receipt)
    expect(replayResult.candidate).toEqual(compensationResult.candidate)
  })

  it('같은 move receipt의 병렬 compensation 중 정확히 하나만 반영한다', async () => {
    const storage = createMemoryCandidateMockStorage()
    const firstRepository = createCandidateMockRepository({ storage })
    const secondRepository = createCandidateMockRepository({ storage })
    const candidate = firstRepository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = firstRepository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-double-compensation-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return

    const [firstResult, secondResult] = await Promise.all([
      firstRepository.commitStageExclusive(
        stageCommitInput(moveResult.candidate, {
          currentStage: candidate.currentStage,
          clientMutationId: 'mutation-double-compensation-first',
          compensatesClientMutationId: moveResult.receipt.clientMutationId,
          committedAt: '2026-08-26T07:01:00.000Z',
        }),
      ),
      secondRepository.commitStageExclusive(
        stageCommitInput(moveResult.candidate, {
          currentStage: candidate.currentStage,
          clientMutationId: 'mutation-double-compensation-second',
          compensatesClientMutationId: moveResult.receipt.clientMutationId,
          committedAt: '2026-08-26T07:01:00.000Z',
        }),
      ),
    ])

    expect([firstResult.status, secondResult.status].sort()).toEqual([
      'undo-not-available',
      'updated',
    ])
    expect(firstRepository.getById(candidate.id)).toMatchObject({
      currentStage: candidate.currentStage,
      revision: candidate.revision + 2,
    })
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

  it('candidate, target stage, revision이 원 receipt와 다르면 보상하지 않는다', () => {
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const [candidate, anotherCandidate] = repository.list(200)
    expect(candidate).toBeDefined()
    expect(anotherCandidate).toBeDefined()
    if (candidate === undefined || anotherCandidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-mismatch-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return
    const baseCompensation = stageCommitInput(moveResult.candidate, {
      currentStage: candidate.currentStage,
      clientMutationId: 'mutation-mismatch-base',
      compensatesClientMutationId: moveResult.receipt.clientMutationId,
      committedAt: '2026-08-26T07:01:00.000Z',
    })

    const results = [
      repository.commitStage({
        ...baseCompensation,
        currentStage: targetStage,
        clientMutationId: 'mutation-mismatch-stage',
      }),
      repository.commitStage({
        ...baseCompensation,
        expectedRevision: moveResult.candidate.revision + 1,
        clientMutationId: 'mutation-mismatch-revision',
      }),
      repository.commitStage({
        ...baseCompensation,
        candidateId: anotherCandidate.id,
        clientMutationId: 'mutation-mismatch-candidate',
      }),
    ]

    expect(results.map(({ status }) => status)).toEqual([
      'undo-not-available',
      'undo-not-available',
      'undo-not-available',
    ])
    expect(
      repository.commitStage({
        ...baseCompensation,
        clientMutationId: 'mutation-mismatch-valid-afterward',
      }).status,
    ).toBe('updated')
  })

  it('원 receipt 이후 후보자가 바뀌면 stale 보상을 재베이스하지 않는다', () => {
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const firstTarget =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: firstTarget,
        clientMutationId: 'mutation-stale-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return
    const latestTarget = firstTarget === 'hired' ? 'rejected' : 'hired'
    const laterMove = repository.commitStage(
      stageCommitInput(moveResult.candidate, {
        currentStage: latestTarget,
        clientMutationId: 'mutation-after-source',
        committedAt: '2026-08-26T07:01:00.000Z',
      }),
    )
    expect(laterMove.status).toBe('updated')

    const compensation = repository.commitStage(
      stageCommitInput(moveResult.candidate, {
        currentStage: candidate.currentStage,
        clientMutationId: 'mutation-stale-compensation',
        compensatesClientMutationId: moveResult.receipt.clientMutationId,
        committedAt: '2026-08-26T07:02:00.000Z',
      }),
    )

    expect(compensation.status).toBe('undo-not-available')
    expect(repository.getById(candidate.id)).toEqual(
      laterMove.status === 'updated' ? laterMove.candidate : undefined,
    )
  })

  it('만료된 move receipt는 보상할 수 없다', () => {
    const receiptTtlMs = 1_000
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
      receiptTtlMs,
    })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-expired-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return
    const afterTtl = new Date(
      Date.parse(FIXED_NOW) + receiptTtlMs + 1,
    ).toISOString()

    const result = repository.commitStage(
      stageCommitInput(moveResult.candidate, {
        currentStage: candidate.currentStage,
        clientMutationId: 'mutation-expired-compensation',
        compensatesClientMutationId: moveResult.receipt.clientMutationId,
        stageChangedAt: afterTtl,
        committedAt: afterTtl,
      }),
    )

    expect(result.status).toBe('undo-not-available')
    expect(repository.getById(candidate.id)).toEqual(moveResult.candidate)
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

  it('v2 receipt를 보존하면서 최신 receipt를 포함해 최대 512개만 v3 envelope에 저장한다', () => {
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

  it('limit 정리에서 compensation receipt가 빠지면 원 receipt도 제거해 재보상을 막는다', () => {
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidates = repository.list(1_000)
    const compensatedCandidate = candidates[0]
    const nextCandidate = candidates[511]
    expect(compensatedCandidate).toBeDefined()
    expect(nextCandidate).toBeDefined()
    if (compensatedCandidate === undefined || nextCandidate === undefined) {
      return
    }
    const originalMutationId = 'zz-original-at-limit'
    const compensationMutationId = 'aa-compensation-at-limit'
    const moveCandidate = {
      ...compensatedCandidate,
      stageChangedAt: FIXED_NOW,
      revision: compensatedCandidate.revision + 1,
    }
    const compensationCandidate = {
      ...moveCandidate,
      revision: compensatedCandidate.revision + 2,
    }
    const mutations: Record<string, unknown> = {
      [compensatedCandidate.id]: {
        currentStage: compensationCandidate.currentStage,
        stageChangedAt: compensationCandidate.stageChangedAt,
        revision: compensationCandidate.revision,
      },
    }
    const receipts: Record<string, unknown> = {
      [originalMutationId]: {
        clientMutationId: originalMutationId,
        candidateId: compensatedCandidate.id,
        currentStage: moveCandidate.currentStage,
        expectedRevision: compensatedCandidate.revision,
        requestId: 'request-original-at-limit',
        committedAt: FIXED_NOW,
        candidate: moveCandidate,
        operationKind: 'move',
        previousStage: compensatedCandidate.currentStage,
      },
      [compensationMutationId]: {
        clientMutationId: compensationMutationId,
        candidateId: compensatedCandidate.id,
        currentStage: compensationCandidate.currentStage,
        expectedRevision: moveCandidate.revision,
        requestId: 'request-compensation-at-limit',
        committedAt: FIXED_NOW,
        candidate: compensationCandidate,
        operationKind: 'compensation',
        previousStage: moveCandidate.currentStage,
        compensatesClientMutationId: originalMutationId,
      },
    }

    candidates.slice(1, 511).forEach((candidate, index) => {
      const updatedCandidate = {
        ...candidate,
        stageChangedAt: FIXED_NOW,
        revision: candidate.revision + 1,
      }
      const clientMutationId = `mm-retained-${String(index).padStart(3, '0')}`
      mutations[candidate.id] = {
        currentStage: updatedCandidate.currentStage,
        stageChangedAt: updatedCandidate.stageChangedAt,
        revision: updatedCandidate.revision,
      }
      receipts[clientMutationId] = {
        clientMutationId,
        candidateId: candidate.id,
        currentStage: updatedCandidate.currentStage,
        expectedRevision: candidate.revision,
        requestId: `request-limit-${index}`,
        committedAt: FIXED_NOW,
        candidate: updatedCandidate,
        operationKind: 'move',
        previousStage: candidate.currentStage,
      }
    })
    storage.write(
      JSON.stringify({
        version: 3,
        seed: 20260826,
        mutations,
        receipts,
        compensationLedger: {
          [originalMutationId]: compensationMutationId,
        },
      }),
    )

    const result = repository.commitStage(
      stageCommitInput(nextCandidate, {
        clientMutationId: 'mutation-after-limit',
        stageChangedAt: '2026-08-26T07:01:00.000Z',
        committedAt: '2026-08-26T07:01:00.000Z',
      }),
    )
    const persisted = JSON.parse(storage.read() ?? '{}') as {
      receipts: Record<string, unknown>
      compensationLedger: Record<string, string>
    }

    expect(result.status).toBe('updated')
    expect(persisted.receipts).not.toHaveProperty(compensationMutationId)
    expect(persisted.receipts).not.toHaveProperty(originalMutationId)
    expect(persisted.compensationLedger).toEqual({})
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

  it('보상 transient rejection은 candidate, receipt, ledger를 소비하지 않는다', async () => {
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidate = repository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-transient-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return
    const compensationInput = stageCommitInput(moveResult.candidate, {
      currentStage: candidate.currentStage,
      clientMutationId: 'mutation-transient-compensation',
      compensatesClientMutationId: moveResult.receipt.clientMutationId,
      committedAt: '2026-08-26T07:01:00.000Z',
    })

    const rejected = await repository.commitStageExclusive(
      compensationInput,
      true,
    )
    const persistedAfterRejection = JSON.parse(storage.read() ?? '{}') as {
      compensationLedger?: Record<string, string>
      receipts?: Record<string, unknown>
    }

    expect(rejected.status).toBe('transient-rejection')
    expect(repository.getById(candidate.id)).toEqual(moveResult.candidate)
    expect(persistedAfterRejection.compensationLedger).toEqual({})
    expect(persistedAfterRejection.receipts).not.toHaveProperty(
      compensationInput.clientMutationId,
    )
    await expect(
      repository.commitStageExclusive(compensationInput),
    ).resolves.toMatchObject({ status: 'updated' })
  })

  it('보상 저장 실패는 candidate, receipt, ledger를 원자적으로 남기지 않는다', () => {
    const memoryStorage = createMemoryCandidateMockStorage()
    const initialRepository = createCandidateMockRepository({
      storage: memoryStorage,
    })
    const candidate = initialRepository.list(200)[0]
    expect(candidate).toBeDefined()
    if (candidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = initialRepository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-write-failure-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return
    const beforeCompensation = memoryStorage.read()
    const failingStorage: CandidateMockStorage = {
      read: memoryStorage.read,
      remove: memoryStorage.remove,
      runExclusive: memoryStorage.runExclusive,
      write: () => {
        throw new Error('storage unavailable')
      },
    }
    const failingRepository = createCandidateMockRepository({
      storage: failingStorage,
    })
    const compensationInput = stageCommitInput(moveResult.candidate, {
      currentStage: candidate.currentStage,
      clientMutationId: 'mutation-write-failure-compensation',
      compensatesClientMutationId: moveResult.receipt.clientMutationId,
      committedAt: '2026-08-26T07:01:00.000Z',
    })

    expect(() => failingRepository.commitStage(compensationInput)).toThrow(
      'storage unavailable',
    )
    expect(memoryStorage.read()).toBe(beforeCompensation)
    expect(initialRepository.getById(candidate.id)).toEqual(
      moveResult.candidate,
    )
    expect(
      createCandidateMockRepository({ storage: memoryStorage }).commitStage(
        compensationInput,
      ).status,
    ).toBe('updated')
  })

  it('v2 overlay와 receipt를 v3 legacy receipt로 안전하게 마이그레이션한다', () => {
    const storage = createMemoryCandidateMockStorage()
    const initialRepository = createCandidateMockRepository({ storage })
    const [candidate, nextCandidate] = initialRepository.list(200)
    expect(candidate).toBeDefined()
    expect(nextCandidate).toBeDefined()
    if (candidate === undefined || nextCandidate === undefined) return
    const updatedCandidate = {
      ...candidate,
      currentStage: 'hired' as const,
      stageChangedAt: FIXED_NOW,
      revision: candidate.revision + 1,
    }
    const legacyMutationId = 'mutation-v2-replay'
    storage.write(
      JSON.stringify({
        version: 2,
        seed: 20260826,
        mutations: {
          [candidate.id]: {
            currentStage: updatedCandidate.currentStage,
            stageChangedAt: updatedCandidate.stageChangedAt,
            revision: updatedCandidate.revision,
          },
        },
        receipts: {
          [legacyMutationId]: {
            clientMutationId: legacyMutationId,
            candidateId: candidate.id,
            currentStage: updatedCandidate.currentStage,
            expectedRevision: candidate.revision,
            requestId: 'request-v2',
            committedAt: FIXED_NOW,
            candidate: updatedCandidate,
          },
        },
      }),
    )
    const migratedRepository = createCandidateMockRepository({ storage })

    const replay = migratedRepository.commitStage(
      stageCommitInput(candidate, {
        currentStage: updatedCandidate.currentStage,
        clientMutationId: legacyMutationId,
      }),
    )
    expect(replay.status).toBe('replayed')
    if (replay.status !== 'replayed') return
    expect(replay.receipt).toMatchObject({ operationKind: 'legacy' })

    const nextCommit = migratedRepository.commitStage(
      stageCommitInput(nextCandidate, {
        clientMutationId: 'mutation-after-v2',
        committedAt: '2026-08-26T07:01:00.000Z',
      }),
    )
    const persisted = JSON.parse(storage.read() ?? '{}') as {
      version: number
      receipts: Record<string, { operationKind: string }>
      compensationLedger: Record<string, string>
    }

    expect(nextCommit.status).toBe('updated')
    expect(persisted.version).toBe(3)
    expect(persisted.receipts[legacyMutationId]).toMatchObject({
      operationKind: 'legacy',
    })
    expect(persisted.receipts['mutation-after-v2']).toMatchObject({
      operationKind: 'move',
    })
    expect(persisted.compensationLedger).toEqual({})
  })

  it('TTL 정리 후 receipt가 사라진 compensation ledger를 남기지 않는다', () => {
    const receiptTtlMs = 1_000
    const storage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage, receiptTtlMs })
    const [candidate, nextCandidate] = repository.list(200)
    expect(candidate).toBeDefined()
    expect(nextCandidate).toBeDefined()
    if (candidate === undefined || nextCandidate === undefined) return
    const targetStage =
      candidate.currentStage === 'hired' ? 'interview' : ('hired' as const)
    const moveResult = repository.commitStage(
      stageCommitInput(candidate, {
        currentStage: targetStage,
        clientMutationId: 'mutation-ledger-source',
      }),
    )
    expect(moveResult.status).toBe('updated')
    if (moveResult.status !== 'updated') return
    const compensationTime = new Date(Date.parse(FIXED_NOW) + 100).toISOString()
    const compensationResult = repository.commitStage(
      stageCommitInput(moveResult.candidate, {
        currentStage: candidate.currentStage,
        clientMutationId: 'mutation-ledger-compensation',
        compensatesClientMutationId: moveResult.receipt.clientMutationId,
        stageChangedAt: compensationTime,
        committedAt: compensationTime,
      }),
    )
    expect(compensationResult.status).toBe('updated')
    const afterTtl = new Date(
      Date.parse(FIXED_NOW) + receiptTtlMs + 101,
    ).toISOString()

    repository.commitStage(
      stageCommitInput(nextCandidate, {
        clientMutationId: 'mutation-ledger-cleanup',
        stageChangedAt: afterTtl,
        committedAt: afterTtl,
      }),
    )
    const persisted = JSON.parse(storage.read() ?? '{}') as {
      receipts: Record<string, unknown>
      compensationLedger: Record<string, string>
    }

    expect(persisted.receipts).not.toHaveProperty('mutation-ledger-source')
    expect(persisted.receipts).not.toHaveProperty(
      'mutation-ledger-compensation',
    )
    expect(persisted.compensationLedger).toEqual({})
  })

  it('유효한 v1 mutation을 보존하고 다음 commit에서 v3 receipt를 함께 저장한다', () => {
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
    expect(persisted.version).toBe(3)
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
