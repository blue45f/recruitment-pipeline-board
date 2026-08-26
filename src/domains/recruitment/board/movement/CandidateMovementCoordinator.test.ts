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
  type CandidateMoveIntent,
  type CandidateMovementNotification,
} from './CandidateMovementCoordinator'

const CANDIDATE_A_ID = 'candidate-a' as CandidateId
const CANDIDATE_B_ID = 'candidate-b' as CandidateId

type Deferred<Value> = Readonly<{
  promise: Promise<Value>
  reject: (reason?: unknown) => void
  resolve: (value: Value) => void
}>

type PendingExecution = Readonly<{
  command: CandidateMoveCommand
  deferred: Deferred<Candidate>
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
    experienceYears: 4,
    id,
    memo: '이동 코디네이터 테스트 후보자입니다.',
    name: id === CANDIDATE_A_ID ? '김하늘' : '이바다',
    revision,
    role: 'frontend_engineer',
    stageChangedAt: '2026-08-01T00:00:00.000Z',
  }
}

function createIntent(
  candidate: Candidate,
  targetStage: CandidateStage,
): CandidateMoveIntent {
  return {
    candidateId: candidate.id,
    candidateName: candidate.name,
    targetStage,
  }
}

function candidateFromCommand(command: CandidateMoveCommand): Candidate {
  return createCandidate(
    command.candidateId,
    command.targetStage,
    command.expectedRevision + 1,
  )
}

function successfulExecution(candidate: Candidate): CandidateMoveExecution {
  return { candidate }
}

function executionError(
  kind:
    'failed' | 'idempotency-conflict' | 'revision-conflict' | 'unknown-outcome',
  safeMessage = '안전한 오류 메시지',
) {
  return new MoveExecutionError({ kind, safeMessage })
}

function createControlledHarness(options: { maxConcurrency?: number } = {}) {
  const candidateA = createCandidate(CANDIDATE_A_ID)
  const candidateB = createCandidate(CANDIDATE_B_ID)
  const confirmed = new Map<CandidateId, Candidate>([
    [candidateA.id, candidateA],
    [candidateB.id, candidateB],
  ])
  const executions: PendingExecution[] = []
  const notifications: CandidateMovementNotification[] = []
  let nextId = 0
  const mergeConfirmed = vi.fn((candidate: Candidate) => {
    confirmed.set(candidate.id, candidate)
  })
  const execute = vi.fn((command: CandidateMoveCommand) => {
    const deferred = createDeferred<Candidate>()

    executions.push({ command, deferred })
    return deferred.promise.then(successfulExecution)
  })
  const reconcile = vi.fn(async (candidateId: CandidateId) => {
    const candidate = confirmed.get(candidateId)

    if (candidate === undefined) {
      throw new Error('missing candidate')
    }

    return candidate
  })
  const notify = vi.fn((result: CandidateMovementNotification) => {
    notifications.push(result)
  })
  const coordinator = createCandidateMovementCoordinator(
    {
      execute,
      mergeConfirmed,
      notify,
      readConfirmedCandidate: (candidateId) => confirmed.get(candidateId),
      reconcile,
    },
    {
      createId: () => `move-${++nextId}`,
      ...(options.maxConcurrency === undefined
        ? {}
        : { maxConcurrency: options.maxConcurrency }),
      now: () => 1_777_777,
    },
  )

  return {
    candidateA,
    candidateB,
    confirmed,
    coordinator,
    execute,
    executions,
    mergeConfirmed,
    notifications,
    notify,
    reconcile,
  }
}

function createVerificationSchedulingHarness() {
  const verificationCandidate = createCandidate(
    'candidate-verification' as CandidateId,
  )
  const blockerCandidate = createCandidate('candidate-blocker' as CandidateId)
  const confirmed = new Map<CandidateId, Candidate>([
    [verificationCandidate.id, verificationCandidate],
    [blockerCandidate.id, blockerCandidate],
  ])
  const commands: CandidateMoveCommand[] = []
  const controlledReconcileCandidateIds: CandidateId[] = []
  const pendingMoves = new Map<CandidateId, Deferred<Candidate>>()
  const pendingReconciliations = new Map<CandidateId, Deferred<Candidate>>()
  const transportStartOrder: string[] = []
  let activeTransports = 0
  let isSeedingVerification = true
  let maxActiveTransports = 0
  let nextId = 0

  const trackTransport = (label: string, promise: Promise<Candidate>) => {
    transportStartOrder.push(label)
    activeTransports += 1
    maxActiveTransports = Math.max(maxActiveTransports, activeTransports)

    return promise.finally(() => {
      activeTransports -= 1
    })
  }
  const execute = vi.fn((command: CandidateMoveCommand) => {
    commands.push(command)

    if (
      isSeedingVerification &&
      command.candidateId === verificationCandidate.id
    ) {
      return Promise.reject(executionError('unknown-outcome'))
    }

    const deferred = createDeferred<Candidate>()

    pendingMoves.set(command.candidateId, deferred)
    return trackTransport(`move:${command.candidateId}`, deferred.promise).then(
      successfulExecution,
    )
  })
  const reconcile = vi.fn((candidateId: CandidateId) => {
    if (isSeedingVerification && candidateId === verificationCandidate.id) {
      return Promise.reject(executionError('failed', '확인하지 못했습니다.'))
    }

    controlledReconcileCandidateIds.push(candidateId)
    const deferred = createDeferred<Candidate>()

    pendingReconciliations.set(candidateId, deferred)
    return trackTransport(`verify:${candidateId}`, deferred.promise)
  })
  const coordinator = createCandidateMovementCoordinator(
    {
      execute,
      mergeConfirmed: (candidate) => confirmed.set(candidate.id, candidate),
      notify: vi.fn(),
      readConfirmedCandidate: (candidateId) => confirmed.get(candidateId),
      reconcile,
    },
    {
      createId: () => `scheduling-${++nextId}`,
      maxConcurrency: 1,
    },
  )

  return {
    beginControlledScheduling() {
      isSeedingVerification = false
      transportStartOrder.length = 0
      maxActiveTransports = 0
    },
    blockerCandidate,
    commands,
    controlledReconcileCandidateIds,
    coordinator,
    getActiveTransports: () => activeTransports,
    getMaxActiveTransports: () => maxActiveTransports,
    pendingMoves,
    pendingReconciliations,
    transportStartOrder,
    verificationCandidate,
  }
}

describe('CandidateMovementCoordinator intent projection', () => {
  it('전송 중 최신 의도 하나만 남기고 원래 단계로 돌아오는 의도도 보존한다', async () => {
    const harness = createControlledHarness({ maxConcurrency: 1 })
    const interview = createIntent(harness.candidateA, 'interview')
    const offer = createIntent(harness.candidateA, 'offer_discussion')
    const returnToOriginal = createIntent(harness.candidateA, 'document_review')

    expect(harness.coordinator.submit(interview).accepted).toBe(true)
    expect(harness.executions).toHaveLength(1)

    expect(harness.coordinator.submit(offer)).toMatchObject({
      accepted: true,
      disposition: 'queued',
    })
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.get(CANDIDATE_A_ID),
    ).toBe('offer_discussion')

    expect(harness.coordinator.submit(offer)).toMatchObject({
      accepted: false,
      reason: 'duplicate-visible-target',
    })
    expect(harness.coordinator.submit(returnToOriginal).accepted).toBe(true)
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.get(CANDIDATE_A_ID),
    ).toBe('document_review')
    expect(harness.executions).toHaveLength(1)

    harness.executions[0]?.deferred.resolve(
      candidateFromCommand(harness.executions[0].command),
    )

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(2)
    })

    expect(
      harness.executions.map(({ command }) => command.targetStage),
    ).toEqual(['interview', 'document_review'])
    expect(harness.executions[1]?.command.expectedRevision).toBe(1)
    expect(harness.notifications).toHaveLength(0)

    harness.executions[1]?.deferred.resolve(
      candidateFromCommand(harness.executions[1].command),
    )

    await vi.waitFor(() => {
      expect(
        harness.coordinator.getSnapshot().pendingCandidateIds,
      ).not.toContain(CANDIDATE_A_ID)
    })

    expect(harness.notifications).toHaveLength(1)
    expect(harness.notifications[0]).toMatchObject({
      status: 'success',
    })
  })

  it('permit을 기다리는 후보자는 큐 순서를 유지한 채 active 의도를 교체한다', async () => {
    const harness = createControlledHarness({ maxConcurrency: 1 })

    harness.coordinator.submit(createIntent(harness.candidateA, 'interview'))
    harness.coordinator.submit(createIntent(harness.candidateB, 'interview'))

    expect(
      harness.coordinator.submit(
        createIntent(harness.candidateB, 'offer_discussion'),
      ),
    ).toMatchObject({ accepted: true, disposition: 'replaced-ready' })
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.get(CANDIDATE_B_ID),
    ).toBe('offer_discussion')

    harness.executions[0]?.deferred.resolve(
      candidateFromCommand(harness.executions[0].command),
    )

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(2)
    })

    expect(harness.executions[1]?.command).toMatchObject({
      candidateId: CANDIDATE_B_ID,
      targetStage: 'offer_discussion',
    })
  })
})

describe('CandidateMovementCoordinator sequential results', () => {
  it.each([
    { first: 'success', second: 'success' },
    { first: 'success', second: 'failure' },
    { first: 'failure', second: 'success' },
    { first: 'failure', second: 'failure' },
  ] as const)(
    '연속 A=$first / B=$second 결과에서 B 의도만 최종 상태를 결정한다',
    async ({ first, second }) => {
      const harness = createControlledHarness({ maxConcurrency: 1 })
      const firstIntent = createIntent(harness.candidateA, 'interview')
      const secondIntent = createIntent(harness.candidateA, 'offer_discussion')

      harness.coordinator.submit(firstIntent)
      harness.coordinator.submit(secondIntent)

      if (first === 'success') {
        harness.executions[0]?.deferred.resolve(
          candidateFromCommand(harness.executions[0].command),
        )
      } else {
        harness.executions[0]?.deferred.reject(executionError('failed'))
      }

      await vi.waitFor(() => {
        expect(harness.executions).toHaveLength(2)
      })

      expect(harness.notifications).toHaveLength(0)
      expect(harness.executions[1]?.command.expectedRevision).toBe(
        first === 'success' ? 1 : 0,
      )
      expect(
        harness.coordinator
          .getSnapshot()
          .stageProjectionByCandidateId.get(CANDIDATE_A_ID),
      ).toBe('offer_discussion')

      if (second === 'success') {
        harness.executions[1]?.deferred.resolve(
          candidateFromCommand(harness.executions[1].command),
        )
      } else {
        harness.executions[1]?.deferred.reject(executionError('failed'))
      }

      await vi.waitFor(() => {
        expect(
          harness.coordinator.getSnapshot().pendingCandidateIds,
        ).not.toContain(CANDIDATE_A_ID)
      })

      const snapshot = harness.coordinator.getSnapshot()

      expect(snapshot.stageProjectionByCandidateId.has(CANDIDATE_A_ID)).toBe(
        false,
      )
      expect(harness.notifications).toHaveLength(1)
      expect(harness.notifications[0]?.status).toBe(second)
      const failure = snapshot.failureByCandidateId.get(CANDIDATE_A_ID)

      expect(failure?.candidateId).toBe(
        second === 'failure' ? CANDIDATE_A_ID : undefined,
      )
      expect(failure?.intent).toEqual(
        second === 'failure' ? secondIntent : undefined,
      )
      expect(failure?.status).toBe(second === 'failure' ? 'failure' : undefined)
      expect(failure?.targetStage).toBe(
        second === 'failure' ? 'offer_discussion' : undefined,
      )
      expect(harness.confirmed.get(CANDIDATE_A_ID)?.currentStage).toBe(
        second === 'success'
          ? 'offer_discussion'
          : first === 'success'
            ? 'interview'
            : 'document_review',
      )
    },
  )
})

describe('CandidateMovementCoordinator scheduling', () => {
  it('서로 다른 후보자를 최대 4개까지만 병렬 실행한다', async () => {
    const harness = createControlledHarness({ maxConcurrency: 4 })
    const candidates = Array.from({ length: 6 }, (_, index) =>
      createCandidate(`candidate-${index}` as CandidateId),
    )

    for (const candidate of candidates) {
      harness.confirmed.set(candidate.id, candidate)
      harness.coordinator.submit(createIntent(candidate, 'interview'))
    }

    expect(harness.executions).toHaveLength(4)
    expect(harness.coordinator.getInFlightCount()).toBe(4)
    expect(harness.coordinator.getSnapshot().pendingCandidateIds.size).toBe(6)

    harness.executions[0]?.deferred.resolve(
      candidateFromCommand(harness.executions[0].command),
    )

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(5)
    })

    expect(harness.coordinator.getInFlightCount()).toBe(4)
    expect(harness.executions[4]?.command.candidateId).toBe(candidates[4]?.id)
  })

  it('A가 연속 의도를 갖더라도 먼저 기다린 B에게 다음 permit을 준다', async () => {
    const harness = createControlledHarness({ maxConcurrency: 1 })

    harness.coordinator.submit(createIntent(harness.candidateA, 'interview'))
    harness.coordinator.submit(createIntent(harness.candidateB, 'interview'))
    harness.coordinator.submit(
      createIntent(harness.candidateA, 'offer_discussion'),
    )

    harness.executions[0]?.deferred.resolve(
      candidateFromCommand(harness.executions[0].command),
    )

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(2)
    })

    expect(harness.executions[1]?.command.candidateId).toBe(CANDIDATE_B_ID)

    harness.executions[1]?.deferred.resolve(
      candidateFromCommand(harness.executions[1].command),
    )

    await vi.waitFor(() => {
      expect(harness.executions).toHaveLength(3)
    })

    expect(harness.executions[2]?.command).toMatchObject({
      candidateId: CANDIDATE_A_ID,
      targetStage: 'offer_discussion',
    })
  })

  it('후보자별 in-flight 요청은 항상 하나뿐이다', () => {
    const harness = createControlledHarness({ maxConcurrency: 4 })

    harness.coordinator.submit(createIntent(harness.candidateA, 'interview'))
    harness.coordinator.submit(
      createIntent(harness.candidateA, 'offer_discussion'),
    )
    harness.coordinator.submit(createIntent(harness.candidateA, 'hired'))

    expect(harness.execute).toHaveBeenCalledTimes(1)
    expect(harness.coordinator.getInFlightCount()).toBe(1)
    expect(
      harness.coordinator
        .getSnapshot()
        .stageProjectionByCandidateId.get(CANDIDATE_A_ID),
    ).toBe('hired')
  })

  it('이동과 verification 재확인이 같은 permit과 FIFO 순서를 공유한다', async () => {
    const normalA = createCandidate('candidate-normal-a' as CandidateId)
    const normalB = createCandidate('candidate-normal-b' as CandidateId)
    const verificationA = createCandidate(
      'candidate-verification-a' as CandidateId,
    )
    const verificationB = createCandidate(
      'candidate-verification-b' as CandidateId,
    )
    const verificationCandidateIds = new Set([
      verificationA.id,
      verificationB.id,
    ])
    const confirmed = new Map<CandidateId, Candidate>(
      [normalA, normalB, verificationA, verificationB].map((candidate) => [
        candidate.id,
        candidate,
      ]),
    )
    const pendingMoves = new Map<CandidateId, Deferred<Candidate>>()
    const pendingVerifications = new Map<CandidateId, Deferred<Candidate>>()
    const startOrder: string[] = []
    let activeTransports = 0
    let isSeedingVerification = true
    let maxActiveTransports = 0

    const trackTransport = (label: string, promise: Promise<Candidate>) => {
      startOrder.push(label)
      activeTransports += 1
      maxActiveTransports = Math.max(maxActiveTransports, activeTransports)

      return promise.finally(() => {
        activeTransports -= 1
      })
    }
    const execute = vi.fn((command: CandidateMoveCommand) => {
      if (
        isSeedingVerification &&
        verificationCandidateIds.has(command.candidateId)
      ) {
        return Promise.reject(executionError('unknown-outcome'))
      }

      const deferred = createDeferred<Candidate>()

      pendingMoves.set(command.candidateId, deferred)
      return trackTransport(
        `move:${command.candidateId}`,
        deferred.promise,
      ).then(successfulExecution)
    })
    const reconcile = vi.fn((candidateId: CandidateId) => {
      if (isSeedingVerification && verificationCandidateIds.has(candidateId)) {
        return Promise.reject(executionError('failed', '확인하지 못했습니다.'))
      }

      const deferred = createDeferred<Candidate>()

      pendingVerifications.set(candidateId, deferred)
      return trackTransport(`verify:${candidateId}`, deferred.promise)
    })
    const coordinator = createCandidateMovementCoordinator(
      {
        execute,
        mergeConfirmed: (candidate) => confirmed.set(candidate.id, candidate),
        notify: vi.fn(),
        readConfirmedCandidate: (candidateId) => confirmed.get(candidateId),
        reconcile,
      },
      { maxConcurrency: 1 },
    )

    coordinator.submit(createIntent(verificationA, 'interview'))
    coordinator.submit(createIntent(verificationB, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().verificationRequiredByCandidateId.size,
      ).toBe(2)
    })

    isSeedingVerification = false
    startOrder.length = 0
    maxActiveTransports = 0

    coordinator.submit(createIntent(normalA, 'interview'))
    const beforeVerificationSnapshot = coordinator.getSnapshot()
    const firstVerification = coordinator.verify(verificationA.id)
    const verificationPendingSnapshot = coordinator.getSnapshot()

    expect(coordinator.verify(verificationA.id)).toBe(firstVerification)
    expect(verificationPendingSnapshot.pendingCandidateIds).toBe(
      beforeVerificationSnapshot.pendingCandidateIds,
    )
    expect(verificationPendingSnapshot.stageProjectionByCandidateId).toBe(
      beforeVerificationSnapshot.stageProjectionByCandidateId,
    )
    expect(
      coordinator
        .getSnapshot()
        .verificationPendingCandidateIds.has(verificationA.id),
    ).toBe(true)

    coordinator.submit(createIntent(normalB, 'interview'))
    const secondVerification = coordinator.verify(verificationB.id)

    expect(
      coordinator
        .getSnapshot()
        .verificationPendingCandidateIds.has(verificationB.id),
    ).toBe(true)
    expect(activeTransports).toBe(1)
    expect(coordinator.getInFlightCount()).toBe(1)
    expect(pendingVerifications.size).toBe(0)

    pendingMoves
      .get(normalA.id)
      ?.resolve(createCandidate(normalA.id, 'interview', 1))

    await vi.waitFor(() => {
      expect(pendingVerifications.has(verificationA.id)).toBe(true)
    })

    expect(pendingMoves.has(normalB.id)).toBe(false)
    expect(activeTransports).toBe(1)
    pendingVerifications
      .get(verificationA.id)
      ?.resolve(createCandidate(verificationA.id, 'interview', 1))

    await firstVerification

    await vi.waitFor(() => {
      expect(pendingMoves.has(normalB.id)).toBe(true)
    })

    expect(pendingVerifications.has(verificationB.id)).toBe(false)
    pendingMoves
      .get(normalB.id)
      ?.resolve(createCandidate(normalB.id, 'interview', 1))

    await vi.waitFor(() => {
      expect(pendingVerifications.has(verificationB.id)).toBe(true)
    })

    pendingVerifications
      .get(verificationB.id)
      ?.resolve(createCandidate(verificationB.id, 'interview', 1))
    await secondVerification

    expect(startOrder).toEqual([
      `move:${normalA.id}`,
      `verify:${verificationA.id}`,
      `move:${normalB.id}`,
      `verify:${verificationB.id}`,
    ])
    expect(maxActiveTransports).toBe(1)
    expect(activeTransports).toBe(0)
    expect(coordinator.getInFlightCount()).toBe(0)
    expect(coordinator.getSnapshot().verificationPendingCandidateIds.size).toBe(
      0,
    )
  })

  it('대기 중인 verification이 새 intent로 무효화되면 move를 이어서 실행한다', async () => {
    const harness = createVerificationSchedulingHarness()

    harness.coordinator.submit(
      createIntent(harness.verificationCandidate, 'interview'),
    )

    await vi.waitFor(() => {
      expect(
        harness.coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.has(
            harness.verificationCandidate.id,
          ),
      ).toBe(true)
    })

    harness.beginControlledScheduling()
    harness.coordinator.submit(
      createIntent(harness.blockerCandidate, 'interview'),
    )
    const verificationPromise = harness.coordinator.verify(
      harness.verificationCandidate.id,
    )

    expect(
      harness.coordinator.submit(
        createIntent(harness.verificationCandidate, 'offer_discussion'),
      ),
    ).toMatchObject({ accepted: true, disposition: 'queued' })
    expect(harness.controlledReconcileCandidateIds).toHaveLength(0)

    harness.pendingMoves
      .get(harness.blockerCandidate.id)
      ?.resolve(createCandidate(harness.blockerCandidate.id, 'interview', 1))

    await expect(verificationPromise).resolves.toEqual({
      candidateId: harness.verificationCandidate.id,
      status: 'not-required',
    })
    expect(
      harness.coordinator
        .getSnapshot()
        .verificationPendingCandidateIds.has(harness.verificationCandidate.id),
    ).toBe(false)

    await vi.waitFor(() => {
      expect(harness.pendingMoves.has(harness.verificationCandidate.id)).toBe(
        true,
      )
    })

    const continuedMove = harness.commands.at(-1)

    expect(continuedMove).toMatchObject({
      candidateId: harness.verificationCandidate.id,
      expectedRevision: 0,
      targetStage: 'offer_discussion',
    })
    expect(harness.controlledReconcileCandidateIds).toHaveLength(0)
    expect(harness.transportStartOrder).toEqual([
      `move:${harness.blockerCandidate.id}`,
      `move:${harness.verificationCandidate.id}`,
    ])
    harness.pendingMoves
      .get(harness.verificationCandidate.id)
      ?.resolve(candidateFromCommand(continuedMove as CandidateMoveCommand))

    await vi.waitFor(() => {
      expect(harness.coordinator.getInFlightCount()).toBe(0)
    })
  })

  it('active verification 중 같은 후보 move는 검증 종료 뒤 시작한다', async () => {
    const harness = createVerificationSchedulingHarness()

    harness.coordinator.submit(
      createIntent(harness.verificationCandidate, 'interview'),
    )

    await vi.waitFor(() => {
      expect(
        harness.coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.has(
            harness.verificationCandidate.id,
          ),
      ).toBe(true)
    })

    harness.beginControlledScheduling()
    const verificationPromise = harness.coordinator.verify(
      harness.verificationCandidate.id,
    )

    expect(harness.getActiveTransports()).toBe(1)
    expect(
      harness.coordinator.submit(
        createIntent(harness.verificationCandidate, 'offer_discussion'),
      ),
    ).toMatchObject({ accepted: true, disposition: 'queued' })
    expect(harness.pendingMoves.has(harness.verificationCandidate.id)).toBe(
      false,
    )
    expect(harness.getActiveTransports()).toBe(1)

    harness.pendingReconciliations
      .get(harness.verificationCandidate.id)
      ?.resolve(
        createCandidate(harness.verificationCandidate.id, 'interview', 1),
      )

    await expect(verificationPromise).resolves.toEqual({
      candidateId: harness.verificationCandidate.id,
      status: 'not-required',
    })

    await vi.waitFor(() => {
      expect(harness.pendingMoves.has(harness.verificationCandidate.id)).toBe(
        true,
      )
    })

    const continuedMove = harness.commands.at(-1)

    expect(continuedMove).toMatchObject({
      candidateId: harness.verificationCandidate.id,
      expectedRevision: 1,
      targetStage: 'offer_discussion',
    })
    expect(harness.transportStartOrder).toEqual([
      `verify:${harness.verificationCandidate.id}`,
      `move:${harness.verificationCandidate.id}`,
    ])
    expect(harness.getMaxActiveTransports()).toBe(1)
    harness.pendingMoves
      .get(harness.verificationCandidate.id)
      ?.resolve(candidateFromCommand(continuedMove as CandidateMoveCommand))

    await vi.waitFor(() => {
      expect(harness.coordinator.getInFlightCount()).toBe(0)
    })

    expect(harness.getActiveTransports()).toBe(0)
  })
})

describe('CandidateMovementCoordinator conflict recovery', () => {
  it('revision 충돌 뒤 최신 단계가 이미 목표라면 PATCH를 반복하지 않는다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const reconciledCandidate = createCandidate(CANDIDATE_A_ID, 'interview', 1)
    const execute = vi.fn(async () => {
      throw executionError('revision-conflict')
    })
    const reconcile = vi.fn(async () => reconciledCandidate)
    const coordinator = createCandidateMovementCoordinator({
      execute,
      mergeConfirmed: vi.fn(),
      notify: vi.fn(),
      readConfirmedCandidate: () => candidate,
      reconcile,
    })

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().lastResultByCandidateId.get(candidate.id),
      ).toMatchObject({ status: 'success' })
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(reconcile).toHaveBeenCalledTimes(1)
  })

  it('revision 충돌은 한 번만 최신 revision과 새 ID로 rebase한다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const reconciledCandidate = createCandidate(
      CANDIDATE_A_ID,
      'document_review',
      7,
    )
    const commands: CandidateMoveCommand[] = []
    const execute = vi.fn(async (command: CandidateMoveCommand) => {
      commands.push(command)
      throw executionError('revision-conflict', '최신 상태가 아닙니다.')
    })
    const reconcile = vi.fn(async () => reconciledCandidate)
    const coordinator = createCandidateMovementCoordinator(
      {
        execute,
        mergeConfirmed: vi.fn(),
        notify: vi.fn(),
        readConfirmedCandidate: () => candidate,
        reconcile,
      },
      {
        createId: (() => {
          let sequence = 0
          return () => `revision-${++sequence}`
        })(),
      },
    )

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().failureByCandidateId.has(candidate.id),
      ).toBe(true)
    })

    expect(commands).toEqual([
      {
        candidateId: candidate.id,
        clientMutationId: 'revision-1',
        expectedRevision: 0,
        targetStage: 'interview',
      },
      {
        candidateId: candidate.id,
        clientMutationId: 'revision-2',
        expectedRevision: 7,
        targetStage: 'interview',
      },
    ])
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(
      coordinator.getSnapshot().failureByCandidateId.get(candidate.id)?.kind,
    ).toBe('revision-conflict')
  })

  it('rebase된 PATCH 결과가 불명이면 실제 rebase command를 검증 기록에 남긴다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const rebasedCandidate = createCandidate(
      CANDIDATE_A_ID,
      'document_review',
      9,
    )
    const commands: CandidateMoveCommand[] = []
    let reconcileCount = 0
    let nextId = 0
    const execute = vi.fn(async (command: CandidateMoveCommand) => {
      commands.push(command)

      if (commands.length === 1) {
        throw executionError('revision-conflict')
      }

      throw executionError('unknown-outcome')
    })
    const reconcile = vi.fn(async () => {
      reconcileCount += 1

      if (reconcileCount === 1) {
        return rebasedCandidate
      }

      throw executionError('failed', '서버가 잠시 불안정합니다.')
    })
    const coordinator = createCandidateMovementCoordinator(
      {
        execute,
        mergeConfirmed: vi.fn(),
        notify: vi.fn(),
        readConfirmedCandidate: () => candidate,
        reconcile,
      },
      { createId: () => `combined-${++nextId}` },
    )

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.get(candidate.id),
      ).toMatchObject({ status: 'verification-required' })
    })

    expect(commands).toEqual([
      {
        candidateId: candidate.id,
        clientMutationId: 'combined-1',
        expectedRevision: 0,
        targetStage: 'interview',
      },
      {
        candidateId: candidate.id,
        clientMutationId: 'combined-2',
        expectedRevision: 9,
        targetStage: 'interview',
      },
      {
        candidateId: candidate.id,
        clientMutationId: 'combined-2',
        expectedRevision: 9,
        targetStage: 'interview',
      },
    ])
    expect(reconcile).toHaveBeenCalledTimes(2)
    expect(
      coordinator
        .getSnapshot()
        .verificationRequiredByCandidateId.get(candidate.id)?.attemptedCommand,
    ).toEqual(commands[1])
    expect(
      coordinator.getSnapshot().stageProjectionByCandidateId.get(candidate.id),
    ).toBe('interview')
  })

  it('idempotency 충돌은 revision rebase를 시도하지 않는다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const reconcile = vi.fn(async () => candidate)
    const execute = vi.fn(async () => {
      throw executionError('idempotency-conflict', '요청 ID가 충돌했습니다.')
    })
    const coordinator = createCandidateMovementCoordinator({
      execute,
      mergeConfirmed: vi.fn(),
      notify: vi.fn(),
      readConfirmedCandidate: () => candidate,
      reconcile,
    })

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().failureByCandidateId.has(candidate.id),
      ).toBe(true)
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(reconcile).not.toHaveBeenCalled()
  })
})

describe('CandidateMovementCoordinator unknown outcomes', () => {
  it('unknown 응답은 같은 ID와 payload로 한 번만 replay한다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const commands: CandidateMoveCommand[] = []
    const execute = vi.fn(async (command: CandidateMoveCommand) => {
      commands.push(command)

      if (commands.length === 1) {
        throw executionError('unknown-outcome')
      }

      return successfulExecution(candidateFromCommand(command))
    })
    const reconcile = vi.fn(async () => candidate)
    const coordinator = createCandidateMovementCoordinator(
      {
        execute,
        mergeConfirmed: vi.fn(),
        notify: vi.fn(),
        readConfirmedCandidate: () => candidate,
        reconcile,
      },
      { createId: () => 'stable-id' },
    )

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().lastResultByCandidateId.get(candidate.id),
      ).toMatchObject({ status: 'success' })
    })

    expect(commands).toHaveLength(2)
    expect(commands[1]).toEqual(commands[0])
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('두 번 unknown이면 reconcile 결과로 성공 여부를 확정한다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const confirmedTarget = createCandidate(CANDIDATE_A_ID, 'interview', 1)
    const execute = vi.fn(async () => {
      throw executionError('unknown-outcome')
    })
    const reconcile = vi.fn(async () => confirmedTarget)
    const coordinator = createCandidateMovementCoordinator({
      execute,
      mergeConfirmed: vi.fn(),
      notify: vi.fn(),
      readConfirmedCandidate: () => candidate,
      reconcile,
    })

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().lastResultByCandidateId.get(candidate.id),
      ).toMatchObject({ status: 'success' })
    })

    expect(execute).toHaveBeenCalledTimes(2)
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(
      coordinator.getSnapshot().pendingCandidateIds.has(candidate.id),
    ).toBe(false)
  })

  it('이전 단계를 읽은 뒤 PATCH가 늦게 반영되면 projection을 유지해 다시 확인한다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const lateConfirmedCandidate = createCandidate(
      CANDIDATE_A_ID,
      'interview',
      1,
    )
    let confirmedCandidate = candidate
    const execute = vi.fn(async () => {
      throw executionError('unknown-outcome', '결과를 확인하지 못했습니다.')
    })
    const reconcile = vi.fn(async () => confirmedCandidate)
    const coordinator = createCandidateMovementCoordinator({
      execute,
      mergeConfirmed: vi.fn(),
      notify: vi.fn(),
      readConfirmedCandidate: () => candidate,
      reconcile,
    })

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.has(candidate.id),
      ).toBe(true)
    })

    const verificationSnapshot = coordinator.getSnapshot()

    expect(verificationSnapshot.pendingCandidateIds.has(candidate.id)).toBe(
      false,
    )
    expect(
      verificationSnapshot.stageProjectionByCandidateId.get(candidate.id),
    ).toBe('interview')
    expect(verificationSnapshot.failureByCandidateId.has(candidate.id)).toBe(
      false,
    )

    confirmedCandidate = lateConfirmedCandidate

    await expect(coordinator.verify(candidate.id)).resolves.toMatchObject({
      status: 'resolved',
    })
    expect(
      coordinator.getSnapshot().lastResultByCandidateId.get(candidate.id),
    ).toMatchObject({ status: 'success' })
    expect(reconcile).toHaveBeenCalledTimes(2)
  })

  it('reconcile도 unknown이면 projection을 유지하고 permit을 반환한다', async () => {
    const candidateA = createCandidate(CANDIDATE_A_ID)
    const candidateB = createCandidate(CANDIDATE_B_ID)
    const confirmed = new Map<CandidateId, Candidate>([
      [candidateA.id, candidateA],
      [candidateB.id, candidateB],
    ])
    const execute = vi.fn(async (command: CandidateMoveCommand) => {
      if (command.candidateId === candidateA.id) {
        throw executionError('unknown-outcome', '저장 결과를 확인해 주세요.')
      }

      return successfulExecution(candidateFromCommand(command))
    })
    const coordinator = createCandidateMovementCoordinator(
      {
        execute,
        mergeConfirmed: (candidate) => confirmed.set(candidate.id, candidate),
        notify: vi.fn(),
        readConfirmedCandidate: (candidateId) => confirmed.get(candidateId),
        reconcile: vi.fn(async () => {
          throw executionError('unknown-outcome', '확인이 더 필요합니다.')
        }),
      },
      { maxConcurrency: 1 },
    )

    coordinator.submit(createIntent(candidateA, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.has(candidateA.id),
      ).toBe(true)
    })

    const verificationSnapshot = coordinator.getSnapshot()

    expect(verificationSnapshot.pendingCandidateIds.has(candidateA.id)).toBe(
      false,
    )
    expect(
      verificationSnapshot.stageProjectionByCandidateId.get(candidateA.id),
    ).toBe('interview')
    expect(coordinator.getInFlightCount()).toBe(0)

    coordinator.submit(createIntent(candidateB, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().lastResultByCandidateId.get(candidateB.id),
      ).toMatchObject({ status: 'success' })
    })

    expect(coordinator.getInFlightCount()).toBe(0)
  })

  it('두 번 unknown 뒤 reconcile이 503으로 실패해도 projection을 유지한다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const coordinator = createCandidateMovementCoordinator({
      execute: vi.fn(async () => {
        throw executionError('unknown-outcome')
      }),
      mergeConfirmed: vi.fn(),
      notify: vi.fn(),
      readConfirmedCandidate: () => candidate,
      reconcile: vi.fn(async () => {
        throw executionError('failed', '서버가 잠시 불안정합니다.')
      }),
    })

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(
        coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.get(candidate.id),
      ).toMatchObject({
        safeMessage: '서버가 잠시 불안정합니다.',
        status: 'verification-required',
      })
    })

    const snapshot = coordinator.getSnapshot()

    expect(snapshot.failureByCandidateId.has(candidate.id)).toBe(false)
    expect(snapshot.pendingCandidateIds.has(candidate.id)).toBe(false)
    expect(snapshot.stageProjectionByCandidateId.get(candidate.id)).toBe(
      'interview',
    )
    expect(coordinator.getInFlightCount()).toBe(0)
  })

  it('queued 의도가 있던 verification을 최신 revision으로 이어서 완료한다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const confirmed = new Map<CandidateId, Candidate>([
      [candidate.id, candidate],
    ])
    const commands: CandidateMoveCommand[] = []
    let canConfirmExecution = false
    let canReconcile = false
    let nextId = 0
    const execute = vi.fn(async (command: CandidateMoveCommand) => {
      commands.push(command)

      if (!canConfirmExecution) {
        throw executionError('unknown-outcome')
      }

      return successfulExecution(candidateFromCommand(command))
    })
    const reconcile = vi.fn(async () => {
      if (!canReconcile) {
        throw executionError('unknown-outcome')
      }

      return createCandidate(CANDIDATE_A_ID, 'interview', 1)
    })
    const coordinator = createCandidateMovementCoordinator(
      {
        execute,
        mergeConfirmed: (nextCandidate) => {
          confirmed.set(nextCandidate.id, nextCandidate)
        },
        notify: vi.fn(),
        readConfirmedCandidate: (candidateId) => confirmed.get(candidateId),
        reconcile,
      },
      { createId: () => `unknown-${++nextId}` },
    )

    coordinator.submit(createIntent(candidate, 'interview'))
    coordinator.submit(createIntent(candidate, 'offer_discussion'))

    await vi.waitFor(() => {
      expect(
        coordinator
          .getSnapshot()
          .verificationRequiredByCandidateId.has(candidate.id),
      ).toBe(true)
    })

    const verification = coordinator
      .getSnapshot()
      .verificationRequiredByCandidateId.get(candidate.id)

    expect(verification).toMatchObject({
      attemptedCommand: {
        clientMutationId: 'unknown-1',
        targetStage: 'interview',
      },
      attemptedIntent: { targetStage: 'interview' },
      intent: { targetStage: 'offer_discussion' },
      projectedStage: 'offer_discussion',
    })
    expect(commands[1]).toEqual(commands[0])

    canReconcile = true
    canConfirmExecution = true
    const resolution = await coordinator.verify(candidate.id)

    expect(resolution).toMatchObject({
      status: 'resubmitted',
      submission: { accepted: true },
    })

    await vi.waitFor(() => {
      expect(
        coordinator.getSnapshot().lastResultByCandidateId.get(candidate.id),
      ).toMatchObject({
        intent: { targetStage: 'offer_discussion' },
        status: 'success',
      })
    })

    expect(commands).toHaveLength(3)
    expect(commands[2]).toMatchObject({
      clientMutationId: 'unknown-2',
      expectedRevision: 1,
      targetStage: 'offer_discussion',
    })
    expect(
      coordinator.getSnapshot().stageProjectionByCandidateId.has(candidate.id),
    ).toBe(false)
  })

  it('retry도 verification을 다시 확인하며 attempted command를 바꾸지 않는다', async () => {
    const candidate = createCandidate(CANDIDATE_A_ID)
    const notify = vi.fn()
    const reconcile = vi.fn(async () => {
      throw executionError('unknown-outcome', '아직 확인되지 않았습니다.')
    })
    const coordinator = createCandidateMovementCoordinator({
      execute: vi.fn(async () => {
        throw executionError('unknown-outcome')
      }),
      mergeConfirmed: vi.fn(),
      notify,
      readConfirmedCandidate: () => candidate,
      reconcile,
    })

    coordinator.submit(createIntent(candidate, 'interview'))

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(1)
    })

    const attemptedCommand = coordinator
      .getSnapshot()
      .verificationRequiredByCandidateId.get(candidate.id)?.attemptedCommand

    expect(coordinator.retry(candidate.id)).toMatchObject({ accepted: true })

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2)
    })

    expect(
      coordinator
        .getSnapshot()
        .verificationRequiredByCandidateId.get(candidate.id)?.attemptedCommand,
    ).toEqual(attemptedCommand)
  })
})

describe('CandidateMovementCoordinator external store lifecycle', () => {
  it('subscriber가 unsubscribe되어도 이미 시작한 작업은 완료된다', async () => {
    const harness = createControlledHarness()
    const listener = vi.fn()
    const unsubscribe = harness.coordinator.subscribe(listener)
    const initialSnapshot = harness.coordinator.getSnapshot()

    expect(harness.coordinator.getSnapshot()).toBe(initialSnapshot)

    harness.coordinator.submit(createIntent(harness.candidateA, 'interview'))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(harness.coordinator.getSnapshot()).not.toBe(initialSnapshot)

    unsubscribe()
    harness.executions[0]?.deferred.resolve(
      candidateFromCommand(harness.executions[0].command),
    )

    await vi.waitFor(() => {
      expect(harness.confirmed.get(CANDIDATE_A_ID)?.currentStage).toBe(
        'interview',
      )
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(
      harness.coordinator
        .getSnapshot()
        .lastResultByCandidateId.get(CANDIDATE_A_ID),
    ).toMatchObject({ status: 'success' })
  })

  it('실패 snapshot의 intent로 후보자별 retry를 실행한다', async () => {
    const harness = createControlledHarness()
    const intent = createIntent(harness.candidateA, 'interview')

    harness.coordinator.submit(intent)
    harness.executions[0]?.deferred.reject(
      executionError('failed', '잠시 후 다시 시도해 주세요.'),
    )

    await vi.waitFor(() => {
      expect(
        harness.coordinator
          .getSnapshot()
          .failureByCandidateId.get(CANDIDATE_A_ID),
      ).toMatchObject({ intent })
    })

    expect(harness.coordinator.retry(CANDIDATE_A_ID).accepted).toBe(true)
    expect(harness.executions).toHaveLength(2)
    expect(
      harness.coordinator
        .getSnapshot()
        .failureByCandidateId.has(CANDIDATE_A_ID),
    ).toBe(false)
  })
})
