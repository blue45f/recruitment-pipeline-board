import { describe, expect, it, vi } from 'vitest'

import type {
  Candidate,
  CandidateId,
  CandidateStage,
} from '../../candidates/model'
import {
  MoveExecutionError,
  createCandidateMovementCoordinator,
  type CandidateMoveCommand,
  type CandidateMoveExecution,
  type CandidateMovementNotification,
} from './CandidateMovementCoordinator'

type Deferred<Value> = Readonly<{
  promise: Promise<Value>
  reject: (reason?: unknown) => void
  resolve: (value: Value) => void
}>

type PendingExecution = Readonly<{
  baseStage: CandidateStage
  command: CandidateMoveCommand
  deferred: Deferred<CandidateMoveExecution>
}>

function createDeferred<Value>(): Deferred<Value> {
  let rejectPromise: (reason?: unknown) => void = () => undefined
  let resolvePromise: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve, reject) => {
    rejectPromise = reject
    resolvePromise = resolve
  })

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  }
}

function createCandidate(
  id: CandidateId,
  currentStage: CandidateStage = 'document_review',
  revision = 0,
): Candidate {
  return {
    appliedAt: '2026-08-01T00:00:00.000Z',
    currentStage,
    email: `${id}@example.com`,
    experienceYears: 5,
    id,
    memo: '실행 취소 테스트 후보자입니다.',
    name: id,
    revision,
    role: 'frontend_engineer',
    stageChangedAt: '2026-08-01T00:00:00.000Z',
  }
}

function executionCandidate(command: CandidateMoveCommand): Candidate {
  return createCandidate(
    command.candidateId,
    command.targetStage,
    command.expectedRevision + 1,
  )
}

function createUndoHarness(
  initialCandidates: readonly Candidate[],
  options: { maxConcurrency?: number } = {},
) {
  const confirmed = new Map(
    initialCandidates.map((candidate) => [candidate.id, candidate]),
  )
  const executions: PendingExecution[] = []
  const notifications: CandidateMovementNotification[] = []
  let activeExecutionCount = 0
  let maxActiveExecutionCount = 0
  let nextId = 0
  const execute = vi.fn((command: CandidateMoveCommand) => {
    const candidate = confirmed.get(command.candidateId)

    if (candidate === undefined) {
      throw new Error('테스트 후보자가 없습니다.')
    }

    const deferred = createDeferred<CandidateMoveExecution>()

    activeExecutionCount += 1
    maxActiveExecutionCount = Math.max(
      maxActiveExecutionCount,
      activeExecutionCount,
    )
    executions.push({
      baseStage: candidate.currentStage,
      command,
      deferred,
    })
    return deferred.promise.finally(() => {
      activeExecutionCount -= 1
    })
  })
  const reconcile = vi.fn(async (candidateId: CandidateId) => {
    const candidate = confirmed.get(candidateId)

    if (candidate === undefined) {
      throw new Error('테스트 후보자가 없습니다.')
    }

    return candidate
  })
  const coordinator = createCandidateMovementCoordinator(
    {
      execute,
      mergeConfirmed: (candidate) => confirmed.set(candidate.id, candidate),
      notify: (notification) => notifications.push(notification),
      readConfirmedCandidate: (candidateId) => confirmed.get(candidateId),
      reconcile,
    },
    {
      createId: () => `operation-${++nextId}`,
      ...(options.maxConcurrency === undefined
        ? {}
        : { maxConcurrency: options.maxConcurrency }),
      now: () => 1_777_777,
    },
  )

  function resolveExecution(index: number, includeUndoReceipt = true) {
    const pending = executions[index]

    if (pending === undefined) {
      throw new Error(`실행 ${index}이 없습니다.`)
    }

    const candidate = executionCandidate(pending.command)
    const canUndo =
      includeUndoReceipt &&
      pending.command.compensatesClientMutationId === undefined

    pending.deferred.resolve({
      candidate,
      ...(canUndo
        ? {
            undoReceipt: {
              candidateId: pending.command.candidateId,
              clientMutationId: pending.command.clientMutationId,
              committedRevision: candidate.revision,
              committedStage: candidate.currentStage,
              previousStage: pending.baseStage,
            },
          }
        : {}),
    })
  }

  return {
    confirmed,
    coordinator,
    execute,
    executions,
    getActiveExecutionCount: () => activeExecutionCount,
    getMaxActiveExecutionCount: () => maxActiveExecutionCount,
    notifications,
    reconcile,
    resolveExecution,
  }
}

function submitInterview(
  coordinator: ReturnType<typeof createCandidateMovementCoordinator>,
  candidate: Candidate,
) {
  return submitStage(coordinator, candidate, 'interview')
}

function submitStage(
  coordinator: ReturnType<typeof createCandidateMovementCoordinator>,
  candidate: Candidate,
  targetStage: CandidateStage,
) {
  return coordinator.submit({
    candidateId: candidate.id,
    candidateName: candidate.name,
    targetStage,
  })
}

describe('CandidateMovementCoordinator Undo receipt', () => {
  it('서버가 확정한 최근 이동만 한 번의 보상 요청으로 되돌린다', async () => {
    const candidate = createCandidate('candidate-undo' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)

    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    expect(harness.coordinator.getSnapshot().undoState?.receipt).toMatchObject({
      candidateId: candidate.id,
      fromStage: 'document_review',
      resultRevision: 1,
      sourceClientMutationId: 'operation-1',
      toStage: 'interview',
    })

    const firstUndo = harness.coordinator.undoLatest()
    const duplicateUndo = harness.coordinator.undoLatest()

    expect(firstUndo).toMatchObject({ accepted: true, disposition: 'started' })
    expect(duplicateUndo).toEqual({
      accepted: false,
      candidateId: candidate.id,
      reason: 'already-consuming',
    })
    expect(harness.executions).toHaveLength(2)
    expect(harness.executions[1]?.command).toEqual({
      candidateId: candidate.id,
      clientMutationId: 'operation-2',
      compensatesClientMutationId: 'operation-1',
      expectedRevision: 1,
      targetStage: 'document_review',
    })
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.get(candidate.id),
    ).toBe('document_review')
    expect(
      harness.coordinator
        .getSnapshot()
        .undoPendingCandidateIds.has(candidate.id),
    ).toBe(true)

    harness.resolveExecution(1)

    if (!firstUndo.accepted) {
      throw new Error('실행 취소가 접수되지 않았습니다.')
    }

    await expect(firstUndo.completion).resolves.toMatchObject({
      candidateId: candidate.id,
      status: 'undo-success',
    })
    expect(harness.confirmed.get(candidate.id)).toMatchObject({
      currentStage: 'document_review',
      revision: 2,
    })
    expect(harness.coordinator.getSnapshot().undoState).toBeUndefined()
    expect(harness.notifications.map(({ status }) => status)).toEqual([
      'success',
      'undo-success',
    ])
  })

  it('검증된 서버 receipt가 없는 성공과 실패에는 Undo를 만들지 않는다', async () => {
    const withoutReceipt = createCandidate(
      'candidate-no-receipt' as CandidateId,
    )
    const failed = createCandidate('candidate-failed' as CandidateId)
    const harness = createUndoHarness([withoutReceipt, failed])

    submitInterview(harness.coordinator, withoutReceipt)
    harness.resolveExecution(0, false)

    await vi.waitFor(() => {
      expect(
        harness.coordinator
          .getSnapshot()
          .lastResultByCandidateId.get(withoutReceipt.id)?.status,
      ).toBe('success')
    })
    expect(harness.coordinator.getSnapshot().undoState).toBeUndefined()

    submitInterview(harness.coordinator, failed)
    harness.executions[1]?.deferred.reject(
      new MoveExecutionError({
        kind: 'failed',
        safeMessage: '저장하지 못했습니다.',
      }),
    )

    await vi.waitFor(() => {
      expect(
        harness.coordinator.getSnapshot().failureByCandidateId.has(failed.id),
      ).toBe(true)
    })
    expect(harness.coordinator.getSnapshot().undoState).toBeUndefined()
  })

  it('더 최신 forward intent와 늦은 과거 응답이 Undo 순서를 뒤집지 않는다', async () => {
    const first = createCandidate('candidate-first' as CandidateId)
    const latest = createCandidate('candidate-latest' as CandidateId)
    const harness = createUndoHarness([first, latest])

    submitInterview(harness.coordinator, first)
    submitInterview(harness.coordinator, latest)
    harness.resolveExecution(1)

    await vi.waitFor(() => {
      expect(
        harness.coordinator.getSnapshot().undoState?.receipt.candidateId,
      ).toBe(latest.id)
    })

    harness.resolveExecution(0)

    await vi.waitFor(() => {
      expect(harness.confirmed.get(first.id)?.currentStage).toBe('interview')
    })
    expect(
      harness.coordinator.getSnapshot().undoState?.receipt.candidateId,
    ).toBe(latest.id)
  })

  it.each([
    {
      expectedFromStage: 'interview',
      firstOutcome: 'success',
      secondOutcome: 'success',
    },
    {
      expectedFromStage: 'document_review',
      firstOutcome: 'failure',
      secondOutcome: 'success',
    },
    {
      expectedFromStage: undefined,
      firstOutcome: 'success',
      secondOutcome: 'failure',
    },
  ] as const)(
    '같은 후보자의 연속 이동에서 A=$firstOutcome, B=$secondOutcome이면 마지막 확정 결과만 Undo receipt를 결정한다',
    async ({ expectedFromStage, firstOutcome, secondOutcome }) => {
      const candidate = createCandidate('candidate-sequential' as CandidateId)
      const harness = createUndoHarness([candidate])

      submitStage(harness.coordinator, candidate, 'interview')
      submitStage(harness.coordinator, candidate, 'offer_discussion')

      if (firstOutcome === 'success') {
        harness.resolveExecution(0)
      } else {
        harness.executions[0]?.deferred.reject(
          new MoveExecutionError({
            kind: 'failed',
            safeMessage: '첫 이동을 저장하지 못했습니다.',
          }),
        )
      }

      await vi.waitFor(() => {
        expect(harness.executions).toHaveLength(2)
      })

      expect(harness.executions[1]?.baseStage).toBe(
        firstOutcome === 'success' ? 'interview' : 'document_review',
      )
      expect(harness.executions[1]?.command).toMatchObject({
        expectedRevision: firstOutcome === 'success' ? 1 : 0,
        targetStage: 'offer_discussion',
      })

      if (secondOutcome === 'success') {
        harness.resolveExecution(1)
      } else {
        harness.executions[1]?.deferred.reject(
          new MoveExecutionError({
            kind: 'failed',
            safeMessage: '두 번째 이동을 저장하지 못했습니다.',
          }),
        )
      }

      await vi.waitFor(() => {
        expect(
          harness.coordinator.getSnapshot().pendingCandidateIds,
        ).not.toContain(candidate.id)
      })

      const expectedUndoState =
        expectedFromStage === undefined
          ? undefined
          : {
              receipt: {
                candidateId: candidate.id,
                candidateName: candidate.name,
                completedAt: 1_777_777,
                fromStage: expectedFromStage,
                intentOrder: 2,
                resultRevision: firstOutcome === 'success' ? 2 : 1,
                sourceClientMutationId: 'operation-2',
                toStage: 'offer_discussion',
              },
              status: 'available',
            }

      expect(harness.coordinator.getSnapshot().undoState).toEqual(
        expectedUndoState,
      )
    },
  )

  it('중복 이동과 후보자 없음 거절은 이미 확정된 Undo receipt를 보존한다', async () => {
    const candidate = createCandidate('candidate-preserved' as CandidateId)
    const missingCandidate = createCandidate('candidate-missing' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)

    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    const availableUndo = harness.coordinator.getSnapshot().undoState

    expect(submitInterview(harness.coordinator, candidate)).toEqual({
      accepted: false,
      candidateId: candidate.id,
      reason: 'duplicate-visible-target',
    })
    expect(submitInterview(harness.coordinator, missingCandidate)).toEqual({
      accepted: false,
      candidateId: missingCandidate.id,
      reason: 'candidate-unavailable',
    })
    expect(harness.coordinator.getSnapshot().undoState).toEqual(availableUndo)
    expect(
      harness.coordinator.getSnapshot().undoState?.receipt
        .sourceClientMutationId,
    ).toBe('operation-1')
    expect(harness.execute).toHaveBeenCalledOnce()
  })

  it('새 forward intent가 수락되면 이전 Undo를 즉시 무효화한다', async () => {
    const first = createCandidate('candidate-first' as CandidateId)
    const next = createCandidate('candidate-next' as CandidateId)
    const harness = createUndoHarness([first, next])

    submitInterview(harness.coordinator, first)
    harness.resolveExecution(0)

    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    submitInterview(harness.coordinator, next)

    expect(harness.coordinator.getSnapshot().undoState).toBeUndefined()
    expect(harness.coordinator.undoLatest()).toEqual({
      accepted: false,
      reason: 'unavailable',
    })
  })
})

describe('CandidateMovementCoordinator Undo scheduling', () => {
  it('Undo는 전역 permit과 FIFO 큐를 공유하며 동시 요청 수를 4개로 제한한다', async () => {
    const undoCandidate = createCandidate('candidate-undo' as CandidateId)
    const blockers = Array.from({ length: 4 }, (_, index) =>
      createCandidate(`candidate-blocker-${index + 1}` as CandidateId),
    )
    const harness = createUndoHarness([undoCandidate, ...blockers], {
      maxConcurrency: 4,
    })

    submitInterview(harness.coordinator, undoCandidate)
    harness.resolveExecution(0)

    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    const undo = harness.coordinator.undoLatest()

    expect(undo).toMatchObject({ accepted: true, disposition: 'started' })

    for (const blocker of blockers) {
      submitInterview(harness.coordinator, blocker)
    }

    expect(harness.executions).toHaveLength(5)
    expect(harness.getActiveExecutionCount()).toBe(4)
    expect(harness.coordinator.getInFlightCount()).toBe(4)
    expect(harness.executions[1]?.command).toMatchObject({
      candidateId: undoCandidate.id,
      compensatesClientMutationId: 'operation-1',
    })
    expect(
      harness.executions.slice(2).map(({ command }) => command.candidateId),
    ).toEqual(blockers.slice(0, 3).map(({ id }) => id))
    expect(
      harness.coordinator
        .getSnapshot()
        .pendingCandidateIds.has(blockers[3]?.id as CandidateId),
    ).toBe(true)
    expect(harness.getMaxActiveExecutionCount()).toBe(4)

    harness.resolveExecution(1)

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(6)
    })
    expect(harness.executions[5]?.command).toMatchObject({
      candidateId: blockers[3]?.id,
      targetStage: 'interview',
    })
    expect(harness.getActiveExecutionCount()).toBe(4)
    expect(harness.coordinator.getInFlightCount()).toBe(4)
    expect(harness.getMaxActiveExecutionCount()).toBe(4)

    if (!undo.accepted) {
      throw new Error('실행 취소가 접수되지 않았습니다.')
    }

    await expect(undo.completion).resolves.toMatchObject({
      status: 'undo-success',
    })

    for (const executionIndex of [2, 3, 4, 5]) {
      harness.resolveExecution(executionIndex)
    }

    await vi.waitFor(() => {
      expect(harness.coordinator.getInFlightCount()).toBe(0)
    })
    expect(harness.getActiveExecutionCount()).toBe(0)
    expect(harness.getMaxActiveExecutionCount()).toBeLessThanOrEqual(4)
  })

  it.each(['forward-first', 'undo-first'] as const)(
    'Undo 진행 중 접수된 최신 forward는 %s 완료 순서에도 최종 Undo 대상이 된다',
    async (completionOrder) => {
      const undoCandidate = createCandidate('candidate-undo' as CandidateId)
      const latestCandidate = createCandidate('candidate-latest' as CandidateId)
      const harness = createUndoHarness([undoCandidate, latestCandidate])

      submitInterview(harness.coordinator, undoCandidate)
      harness.resolveExecution(0)
      await vi.waitFor(() => {
        expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
          'available',
        )
      })

      const undo = harness.coordinator.undoLatest()

      expect(
        submitInterview(harness.coordinator, latestCandidate),
      ).toMatchObject({ accepted: true, disposition: 'started' })
      expect(harness.executions).toHaveLength(3)

      if (!undo.accepted) {
        throw new Error('실행 취소가 접수되지 않았습니다.')
      }

      if (completionOrder === 'forward-first') {
        harness.resolveExecution(2)
        await vi.waitUntil(
          () =>
            harness.confirmed.get(latestCandidate.id)?.currentStage ===
              'interview' &&
            harness.confirmed.get(latestCandidate.id)?.revision === 1,
        )
        harness.resolveExecution(1)
      } else {
        harness.resolveExecution(1)
        await undo.completion
        harness.resolveExecution(2)
      }

      await expect(undo.completion).resolves.toMatchObject({
        status: 'undo-success',
      })
      await vi.waitUntil(
        () =>
          harness.confirmed.get(latestCandidate.id)?.currentStage ===
            'interview' &&
          harness.confirmed.get(latestCandidate.id)?.revision === 1,
      )
      expect(
        harness.coordinator.getSnapshot().undoState?.receipt.candidateId,
      ).toBe(latestCandidate.id)
      expect(harness.coordinator.getSnapshot().undoState).toMatchObject({
        receipt: {
          candidateId: latestCandidate.id,
          fromStage: 'document_review',
          resultRevision: 1,
          sourceClientMutationId: 'operation-3',
          toStage: 'interview',
        },
        status: 'available',
      })
    },
  )
})

describe('CandidateMovementCoordinator Undo recovery', () => {
  it('stale stage 또는 revision이면 보상 요청을 보내지 않는다', async () => {
    const candidate = createCandidate('candidate-stale' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)

    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    harness.confirmed.set(
      candidate.id,
      createCandidate(candidate.id, 'offer_discussion', 2),
    )

    expect(harness.coordinator.undoLatest()).toEqual({
      accepted: false,
      candidateId: candidate.id,
      reason: 'stale',
    })
    expect(harness.execute).toHaveBeenCalledTimes(1)
    expect(harness.notifications.at(-1)).toMatchObject({
      currentStage: 'offer_discussion',
      kind: 'stale',
      retryable: false,
      status: 'undo-failure',
    })
  })

  it('Undo 409는 최신 후보자를 병합하되 과거 단계로 rebase하지 않는다', async () => {
    const candidate = createCandidate('candidate-conflict' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)
    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    const undo = harness.coordinator.undoLatest()

    harness.confirmed.set(
      candidate.id,
      createCandidate(candidate.id, 'hired', 2),
    )
    harness.executions[1]?.deferred.reject(
      new MoveExecutionError({
        kind: 'undo-unavailable',
        safeMessage: '이 이동은 더 이상 되돌릴 수 없습니다.',
      }),
    )

    if (!undo.accepted) {
      throw new Error('실행 취소가 접수되지 않았습니다.')
    }

    await expect(undo.completion).resolves.toMatchObject({
      currentStage: 'hired',
      retryable: false,
      status: 'undo-failure',
    })
    expect(harness.execute).toHaveBeenCalledTimes(2)
    expect(harness.reconcile).toHaveBeenCalledOnce()
    expect(harness.coordinator.getSnapshot().undoState).toBeUndefined()
  })

  it('명시적 실패는 투영을 롤백하고 같은 receipt로 새 보상을 재시도한다', async () => {
    const candidate = createCandidate('candidate-retry' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)
    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    const firstUndo = harness.coordinator.undoLatest()

    harness.executions[1]?.deferred.reject(
      new MoveExecutionError({
        kind: 'failed',
        safeMessage: '잠시 후 다시 시도해 주세요.',
      }),
    )

    if (!firstUndo.accepted) {
      throw new Error('실행 취소가 접수되지 않았습니다.')
    }

    await expect(firstUndo.completion).resolves.toMatchObject({
      retryable: true,
      status: 'undo-failure',
    })
    expect(harness.coordinator.getSnapshot().undoState).toMatchObject({
      status: 'failure',
    })
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.has(candidate.id),
    ).toBe(false)

    const retry = harness.coordinator.undoLatest()

    expect(harness.executions[2]?.command).toMatchObject({
      clientMutationId: 'operation-3',
      compensatesClientMutationId: 'operation-1',
    })
    harness.resolveExecution(2)

    if (!retry.accepted) {
      throw new Error('실행 취소 재시도가 접수되지 않았습니다.')
    }

    await expect(retry.completion).resolves.toMatchObject({
      status: 'undo-success',
    })
  })

  it('결과 불명은 같은 보상 command로 replay하고 재확인 상태를 유지한다', async () => {
    const candidate = createCandidate('candidate-unknown' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)
    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    const undo = harness.coordinator.undoLatest()
    const unknownError = new MoveExecutionError({
      kind: 'unknown-outcome',
      safeMessage: '결과를 확인하지 못했습니다.',
    })

    harness.executions[1]?.deferred.reject(unknownError)
    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(3)
    })
    expect(harness.executions[2]?.command).toEqual(
      harness.executions[1]?.command,
    )
    harness.executions[2]?.deferred.reject(unknownError)

    if (!undo.accepted) {
      throw new Error('실행 취소가 접수되지 않았습니다.')
    }

    await expect(undo.completion).resolves.toMatchObject({
      status: 'undo-verification-required',
    })
    expect(harness.coordinator.getSnapshot().undoState).toMatchObject({
      status: 'verification-required',
    })
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.get(candidate.id),
    ).toBe('document_review')

    const verification = harness.coordinator.undoLatest()

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(4)
    })
    expect(harness.executions[3]?.command).toEqual(
      harness.executions[1]?.command,
    )
    harness.resolveExecution(3)

    if (!verification.accepted) {
      throw new Error('실행 취소 재확인이 접수되지 않았습니다.')
    }

    await expect(verification.completion).resolves.toMatchObject({
      status: 'undo-success',
    })
  })

  it('새 coordinator는 서버 확정 단계만 읽고 이전 Undo 상태를 복원하지 않는다', async () => {
    const candidate = createCandidate('candidate-reload' as CandidateId)
    const harness = createUndoHarness([candidate])

    submitInterview(harness.coordinator, candidate)
    harness.resolveExecution(0)
    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot().undoState?.status).toBe(
        'available',
      )
    })

    const reloaded = createUndoHarness([
      harness.confirmed.get(candidate.id) as Candidate,
    ])

    expect(reloaded.coordinator.getSnapshot().undoState).toBeUndefined()
    expect(reloaded.confirmed.get(candidate.id)).toMatchObject({
      currentStage: 'interview',
      revision: 1,
    })
  })
})
