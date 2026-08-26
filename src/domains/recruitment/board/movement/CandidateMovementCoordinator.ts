import type {
  Candidate,
  CandidateId,
  CandidateStage,
} from '../../candidates/model'

const DEFAULT_FAILURE_MESSAGE = '단계 변경을 저장하지 못했습니다.'
const CANDIDATE_UNAVAILABLE_MESSAGE = '후보자의 최신 정보를 확인할 수 없습니다.'

export type CandidateMoveIntent = Readonly<{
  candidateId: CandidateId
  candidateName: string
  targetStage: CandidateStage
}>

export type CandidateMoveCommand = Readonly<{
  candidateId: CandidateId
  clientMutationId: string
  expectedRevision: number
  targetStage: CandidateStage
}>

export type MoveExecutionErrorKind =
  'failed' | 'idempotency-conflict' | 'revision-conflict' | 'unknown-outcome'

export type MoveExecutionErrorOptions = Readonly<{
  cause?: unknown
  kind: MoveExecutionErrorKind
  safeMessage: string
}>

/**
 * Transport details are normalized at the adapter boundary. The coordinator
 * only needs the recovery category and a message that is safe to show.
 */
export class MoveExecutionError extends Error {
  readonly kind: MoveExecutionErrorKind
  readonly safeMessage: string

  constructor(options: MoveExecutionErrorOptions) {
    super(
      options.safeMessage,
      options.cause === undefined ? undefined : { cause: options.cause },
    )
    this.name = 'MoveExecutionError'
    this.kind = options.kind
    this.safeMessage = options.safeMessage
  }
}

export type CandidateMoveSuccess = Readonly<{
  candidate: Candidate
  candidateId: CandidateId
  completedAt: number
  intent: CandidateMoveIntent
  status: 'success'
}>

export type CandidateMoveFailure = Readonly<{
  candidateId: CandidateId
  candidateName: string
  completedAt: number
  intent: CandidateMoveIntent
  kind: MoveExecutionErrorKind
  safeMessage: string
  status: 'failure'
  targetStage: CandidateStage
}>

export type CandidateMoveVerificationRequired = Readonly<{
  attemptedCommand: CandidateMoveCommand
  attemptedIntent: CandidateMoveIntent
  candidateId: CandidateId
  candidateName: string
  completedAt: number
  intent: CandidateMoveIntent
  projectedStage: CandidateStage
  safeMessage: string
  status: 'verification-required'
}>

export type CandidateMoveResult =
  | CandidateMoveFailure
  | CandidateMoveSuccess
  | CandidateMoveVerificationRequired

export type CandidateMoveVerificationResolution =
  | Readonly<{
      candidateId: CandidateId
      status: 'not-required'
    }>
  | Readonly<{
      result: CandidateMoveSuccess
      status: 'resolved'
    }>
  | Readonly<{
      status: 'resubmitted'
      submission: CandidateMoveSubmission
    }>
  | Readonly<{
      result: CandidateMoveVerificationRequired
      status: 'verification-required'
    }>

export type CandidateMovementSnapshot = Readonly<{
  failureByCandidateId: ReadonlyMap<CandidateId, CandidateMoveFailure>
  lastResultByCandidateId: ReadonlyMap<CandidateId, CandidateMoveResult>
  pendingCandidateIds: ReadonlySet<CandidateId>
  stageProjectionByCandidateId: ReadonlyMap<CandidateId, CandidateStage>
  verificationPendingCandidateIds: ReadonlySet<CandidateId>
  verificationRequiredByCandidateId: ReadonlyMap<
    CandidateId,
    CandidateMoveVerificationRequired
  >
  version: number
}>

export type CandidateMovementAdapters = Readonly<{
  execute: (command: CandidateMoveCommand) => Promise<Candidate>
  mergeConfirmed: (candidate: Candidate) => void
  notify: (result: CandidateMoveResult) => void
  readConfirmedCandidate: (candidateId: CandidateId) => Candidate | undefined
  reconcile: (candidateId: CandidateId) => Promise<Candidate>
}>

export type CandidateMovementCoordinatorOptions = Readonly<{
  createId?: () => string
  maxConcurrency?: number
  now?: () => number
}>

export type CandidateMoveSubmission =
  | Readonly<{
      accepted: true
      candidateId: CandidateId
      disposition: 'queued' | 'replaced-ready' | 'started'
    }>
  | Readonly<{
      accepted: false
      candidateId: CandidateId
      reason:
        | 'candidate-unavailable'
        | 'duplicate-visible-target'
        | 'no-failure-to-retry'
    }>

type ReadyLane = Readonly<{
  intent: CandidateMoveIntent
  phase: 'ready'
}>

type SendingLane = Readonly<{
  command: CandidateMoveCommand
  intent: CandidateMoveIntent
  phase: 'sending'
  queuedIntent?: CandidateMoveIntent
}>

type CandidateLane = ReadyLane | SendingLane

type OperationSuccess = Readonly<{
  candidate: Candidate
  status: 'success'
}>

type OperationFailure = Readonly<{
  error: MoveExecutionError
  status: 'failure'
}>

type OperationVerificationRequired = Readonly<{
  error: MoveExecutionError
  status: 'verification-required'
}>

type OperationOutcome =
  OperationFailure | OperationSuccess | OperationVerificationRequired

type OperationRunResult = Readonly<{
  attemptedCommand: CandidateMoveCommand
  outcome: OperationOutcome
}>

type MoveReadyTask = Readonly<{
  candidateId: CandidateId
  kind: 'move'
}>

type VerificationReadyTask = Readonly<{
  attemptedMutationId: string
  candidateId: CandidateId
  kind: 'verification'
}>

type ReadyTask = MoveReadyTask | VerificationReadyTask

type VerificationRun = Readonly<{
  attemptedMutationId: string
  promise: Promise<CandidateMoveVerificationResolution>
  resolve: (resolution: CandidateMoveVerificationResolution) => void
}>

function defaultCreateId() {
  return globalThis.crypto.randomUUID()
}

function asExecutionError(error: unknown) {
  if (error instanceof MoveExecutionError) {
    return error
  }

  return new MoveExecutionError({
    cause: error,
    kind: 'failed',
    safeMessage: DEFAULT_FAILURE_MESSAGE,
  })
}

function cloneIntent(intent: CandidateMoveIntent): CandidateMoveIntent {
  return {
    candidateId: intent.candidateId,
    candidateName: intent.candidateName,
    targetStage: intent.targetStage,
  }
}

function createEmptySnapshot(): CandidateMovementSnapshot {
  return {
    failureByCandidateId: new Map(),
    lastResultByCandidateId: new Map(),
    pendingCandidateIds: new Set(),
    stageProjectionByCandidateId: new Map(),
    verificationPendingCandidateIds: new Set(),
    verificationRequiredByCandidateId: new Map(),
    version: 0,
  }
}

function createVerificationRun(attemptedMutationId: string): VerificationRun {
  let resolveRun: (
    resolution: CandidateMoveVerificationResolution,
  ) => void = () => undefined
  const promise = new Promise<CandidateMoveVerificationResolution>(
    (resolve) => {
      resolveRun = resolve
    },
  )

  return {
    attemptedMutationId,
    promise,
    resolve: resolveRun,
  }
}

function mapsEqual<Key, Value>(
  first: ReadonlyMap<Key, Value>,
  second: ReadonlyMap<Key, Value>,
) {
  if (first.size !== second.size) return false

  for (const [key, value] of first) {
    if (!Object.is(second.get(key), value)) return false
  }

  return true
}

function setsEqual<Value>(
  first: ReadonlySet<Value>,
  second: ReadonlySet<Value>,
) {
  if (first.size !== second.size) return false

  for (const value of first) {
    if (!second.has(value)) return false
  }

  return true
}

function reuseMapIfEqual<Key, Value>(
  next: ReadonlyMap<Key, Value>,
  previous: ReadonlyMap<Key, Value>,
) {
  return mapsEqual(next, previous) ? previous : next
}

function reuseSetIfEqual<Value>(
  next: ReadonlySet<Value>,
  previous: ReadonlySet<Value>,
) {
  return setsEqual(next, previous) ? previous : next
}

export class CandidateMovementCoordinator {
  private readonly activeNetworkCandidateIds = new Set<CandidateId>()
  private activeRequestCount = 0
  private readonly adapters: CandidateMovementAdapters
  private readonly createId: () => string
  private readonly failureByCandidateId = new Map<
    CandidateId,
    CandidateMoveFailure
  >()
  private readonly knownConfirmedByCandidateId = new Map<
    CandidateId,
    Candidate
  >()
  private readonly lanes = new Map<CandidateId, CandidateLane>()
  private readonly lastResultByCandidateId = new Map<
    CandidateId,
    CandidateMoveResult
  >()
  private readonly listeners = new Set<() => void>()
  private readonly maxConcurrency: number
  private readonly now: () => number
  private readonly readyQueue: ReadyTask[] = []
  private snapshot = createEmptySnapshot()
  private readonly stickyProjectionByCandidateId = new Map<
    CandidateId,
    CandidateStage
  >()
  private readonly verificationRequiredByCandidateId = new Map<
    CandidateId,
    CandidateMoveVerificationRequired
  >()
  private readonly verificationRunByCandidateId = new Map<
    CandidateId,
    VerificationRun
  >()

  constructor(
    adapters: CandidateMovementAdapters,
    options: CandidateMovementCoordinatorOptions = {},
  ) {
    const maxConcurrency = options.maxConcurrency ?? 4

    if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
      throw new RangeError('maxConcurrency must be a positive integer.')
    }

    this.adapters = adapters
    this.createId = options.createId ?? defaultCreateId
    this.maxConcurrency = maxConcurrency
    this.now = options.now ?? Date.now
  }

  readonly getSnapshot = () => this.snapshot

  readonly getInFlightCount = () => this.activeRequestCount

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  submit(intent: CandidateMoveIntent): CandidateMoveSubmission {
    const nextIntent = cloneIntent(intent)
    const existingLane = this.lanes.get(nextIntent.candidateId)

    if (existingLane?.phase === 'ready') {
      if (existingLane.intent.targetStage === nextIntent.targetStage) {
        return this.duplicateSubmission(nextIntent.candidateId)
      }

      this.clearTerminalState(nextIntent.candidateId)
      this.lanes.set(nextIntent.candidateId, {
        intent: nextIntent,
        phase: 'ready',
      })
      this.publish()
      this.pump()

      return {
        accepted: true,
        candidateId: nextIntent.candidateId,
        disposition: 'replaced-ready',
      }
    }

    if (existingLane?.phase === 'sending') {
      const visibleTarget =
        existingLane.queuedIntent?.targetStage ??
        existingLane.intent.targetStage

      if (visibleTarget === nextIntent.targetStage) {
        return this.duplicateSubmission(nextIntent.candidateId)
      }

      this.clearTerminalState(nextIntent.candidateId)
      this.lanes.set(nextIntent.candidateId, {
        ...existingLane,
        queuedIntent: nextIntent,
      })
      this.publish()

      return {
        accepted: true,
        candidateId: nextIntent.candidateId,
        disposition: 'queued',
      }
    }

    const confirmedCandidate = this.readConfirmedCandidate(
      nextIntent.candidateId,
    )

    if (confirmedCandidate === undefined) {
      return {
        accepted: false,
        candidateId: nextIntent.candidateId,
        reason: 'candidate-unavailable',
      }
    }

    const stickyProjection = this.stickyProjectionByCandidateId.get(
      nextIntent.candidateId,
    )
    const visibleTarget = stickyProjection ?? confirmedCandidate.currentStage

    if (visibleTarget === nextIntent.targetStage) {
      return this.duplicateSubmission(nextIntent.candidateId)
    }

    this.clearTerminalState(nextIntent.candidateId)
    this.lanes.set(nextIntent.candidateId, {
      intent: nextIntent,
      phase: 'ready',
    })
    this.readyQueue.push({
      candidateId: nextIntent.candidateId,
      kind: 'move',
    })
    this.publish()
    this.pump()

    const disposition =
      this.lanes.get(nextIntent.candidateId)?.phase === 'sending'
        ? 'started'
        : 'queued'

    return {
      accepted: true,
      candidateId: nextIntent.candidateId,
      disposition,
    }
  }

  retry(candidateId: CandidateId): CandidateMoveSubmission {
    const failure = this.failureByCandidateId.get(candidateId)

    if (failure === undefined) {
      if (this.verificationRequiredByCandidateId.has(candidateId)) {
        void this.verify(candidateId)

        return {
          accepted: true,
          candidateId,
          disposition: 'started',
        }
      }

      return {
        accepted: false,
        candidateId,
        reason: 'no-failure-to-retry',
      }
    }

    const confirmedCandidate = this.readConfirmedCandidate(candidateId)

    if (
      confirmedCandidate !== undefined &&
      confirmedCandidate.currentStage === failure.targetStage &&
      !this.lanes.has(candidateId)
    ) {
      this.clearTerminalState(candidateId)
      this.completeWithoutRequest(failure.intent, confirmedCandidate)

      return {
        accepted: true,
        candidateId,
        disposition: 'started',
      }
    }

    return this.submit(failure.intent)
  }

  verify(
    candidateId: CandidateId,
  ): Promise<CandidateMoveVerificationResolution> {
    const currentRun = this.verificationRunByCandidateId.get(candidateId)

    if (currentRun !== undefined) {
      return currentRun.promise
    }

    const verification = this.verificationRequiredByCandidateId.get(candidateId)

    if (verification === undefined) {
      return Promise.resolve({ candidateId, status: 'not-required' })
    }

    const run = createVerificationRun(
      verification.attemptedCommand.clientMutationId,
    )

    this.verificationRunByCandidateId.set(candidateId, run)
    this.readyQueue.push({
      attemptedMutationId: run.attemptedMutationId,
      candidateId,
      kind: 'verification',
    })
    this.publish()
    this.pump()

    return run.promise
  }

  private acceptConfirmedCandidate(candidate: Candidate) {
    const current = this.knownConfirmedByCandidateId.get(candidate.id)

    if (current !== undefined && current.revision >= candidate.revision) {
      return current
    }

    this.knownConfirmedByCandidateId.set(candidate.id, candidate)
    this.adapters.mergeConfirmed(candidate)

    return candidate
  }

  private async attemptCommand(
    command: CandidateMoveCommand,
  ): Promise<OperationOutcome> {
    try {
      return {
        candidate: await this.adapters.execute(command),
        status: 'success',
      }
    } catch (firstError) {
      const normalizedFirstError = asExecutionError(firstError)

      if (normalizedFirstError.kind !== 'unknown-outcome') {
        return { error: normalizedFirstError, status: 'failure' }
      }

      try {
        return {
          candidate: await this.adapters.execute(command),
          status: 'success',
        }
      } catch (replayError) {
        const normalizedReplayError = asExecutionError(replayError)

        if (normalizedReplayError.kind !== 'unknown-outcome') {
          return { error: normalizedReplayError, status: 'failure' }
        }

        try {
          const reconciledCandidate = this.acceptConfirmedCandidate(
            await this.adapters.reconcile(command.candidateId),
          )

          if (reconciledCandidate.currentStage === command.targetStage) {
            return { candidate: reconciledCandidate, status: 'success' }
          }

          // A read that still shows the previous stage does not prove that a
          // timed-out PATCH was rejected; it may commit after this GET. Keep
          // the projection until a later verification can establish the result.
          return {
            error: normalizedReplayError,
            status: 'verification-required',
          }
        } catch (reconcileError) {
          const normalizedReconcileError = asExecutionError(reconcileError)

          return {
            error: normalizedReconcileError,
            status: 'verification-required',
          }
        }
      }
    }
  }

  private clearTerminalState(candidateId: CandidateId) {
    this.failureByCandidateId.delete(candidateId)
    this.lastResultByCandidateId.delete(candidateId)
    this.stickyProjectionByCandidateId.delete(candidateId)
    this.verificationRequiredByCandidateId.delete(candidateId)
  }

  private completeOperation(
    candidateId: CandidateId,
    laneCommand: CandidateMoveCommand,
    runResult: OperationRunResult,
  ) {
    const lane = this.lanes.get(candidateId)

    if (
      lane?.phase !== 'sending' ||
      lane.command.clientMutationId !== laneCommand.clientMutationId
    ) {
      return
    }

    const { attemptedCommand, outcome } = runResult

    this.activeNetworkCandidateIds.delete(candidateId)
    this.activeRequestCount -= 1

    const confirmedCandidate =
      outcome.status === 'success'
        ? this.acceptConfirmedCandidate(outcome.candidate)
        : undefined

    if (
      outcome.status !== 'verification-required' &&
      lane.queuedIntent !== undefined
    ) {
      this.lanes.set(candidateId, {
        intent: lane.queuedIntent,
        phase: 'ready',
      })
      this.readyQueue.push({ candidateId, kind: 'move' })
      this.pump()
      return
    }

    this.lanes.delete(candidateId)

    if (outcome.status === 'success') {
      const result: CandidateMoveSuccess = {
        candidate: confirmedCandidate ?? outcome.candidate,
        candidateId,
        completedAt: this.now(),
        intent: lane.intent,
        status: 'success',
      }

      this.lastResultByCandidateId.set(candidateId, result)
      this.publishAndNotify(result)
      this.pump()
      return
    }

    if (outcome.status === 'verification-required') {
      const projectedIntent = lane.queuedIntent ?? lane.intent
      const result: CandidateMoveVerificationRequired = {
        attemptedCommand,
        attemptedIntent: lane.intent,
        candidateId,
        candidateName: projectedIntent.candidateName,
        completedAt: this.now(),
        intent: projectedIntent,
        projectedStage: projectedIntent.targetStage,
        safeMessage: outcome.error.safeMessage,
        status: 'verification-required',
      }

      this.stickyProjectionByCandidateId.set(
        candidateId,
        projectedIntent.targetStage,
      )
      this.verificationRequiredByCandidateId.set(candidateId, result)
      this.lastResultByCandidateId.set(candidateId, result)
      this.publishAndNotify(result)
      this.pump()
      return
    }

    const result = this.createFailure(lane.intent, outcome.error)

    this.failureByCandidateId.set(candidateId, result)
    this.lastResultByCandidateId.set(candidateId, result)
    this.publishAndNotify(result)
    this.pump()
  }

  private completeWithoutRequest(
    intent: CandidateMoveIntent,
    candidate: Candidate,
  ) {
    const result: CandidateMoveSuccess = {
      candidate,
      candidateId: intent.candidateId,
      completedAt: this.now(),
      intent,
      status: 'success',
    }

    this.lastResultByCandidateId.set(intent.candidateId, result)
    this.publishAndNotify(result)
  }

  private createCommand(
    candidateId: CandidateId,
    targetStage: CandidateStage,
    candidate: Candidate,
  ): CandidateMoveCommand {
    return {
      candidateId,
      clientMutationId: this.createId(),
      expectedRevision: candidate.revision,
      targetStage,
    }
  }

  private createFailure(
    intent: CandidateMoveIntent,
    error: MoveExecutionError,
  ): CandidateMoveFailure {
    return {
      candidateId: intent.candidateId,
      candidateName: intent.candidateName,
      completedAt: this.now(),
      intent,
      kind: error.kind,
      safeMessage: error.safeMessage,
      status: 'failure',
      targetStage: intent.targetStage,
    }
  }

  private duplicateSubmission(
    candidateId: CandidateId,
  ): CandidateMoveSubmission {
    return {
      accepted: false,
      candidateId,
      reason: 'duplicate-visible-target',
    }
  }

  private publish() {
    const previousSnapshot = this.snapshot
    const pendingCandidateIds = new Set(this.lanes.keys())
    const stageProjectionByCandidateId = new Map(
      this.stickyProjectionByCandidateId,
    )

    for (const [candidateId, lane] of this.lanes) {
      stageProjectionByCandidateId.set(
        candidateId,
        lane.phase === 'sending' && lane.queuedIntent !== undefined
          ? lane.queuedIntent.targetStage
          : lane.intent.targetStage,
      )
    }

    this.snapshot = {
      failureByCandidateId: reuseMapIfEqual(
        new Map(this.failureByCandidateId),
        previousSnapshot.failureByCandidateId,
      ),
      lastResultByCandidateId: reuseMapIfEqual(
        new Map(this.lastResultByCandidateId),
        previousSnapshot.lastResultByCandidateId,
      ),
      pendingCandidateIds: reuseSetIfEqual(
        pendingCandidateIds,
        previousSnapshot.pendingCandidateIds,
      ),
      stageProjectionByCandidateId: reuseMapIfEqual(
        stageProjectionByCandidateId,
        previousSnapshot.stageProjectionByCandidateId,
      ),
      verificationPendingCandidateIds: reuseSetIfEqual(
        new Set(this.verificationRunByCandidateId.keys()),
        previousSnapshot.verificationPendingCandidateIds,
      ),
      verificationRequiredByCandidateId: reuseMapIfEqual(
        new Map(this.verificationRequiredByCandidateId),
        previousSnapshot.verificationRequiredByCandidateId,
      ),
      version: this.snapshot.version + 1,
    }

    for (const listener of this.listeners) {
      listener()
    }
  }

  private publishAndNotify(result: CandidateMoveResult) {
    this.publish()

    try {
      this.adapters.notify(result)
    } catch {
      // Presentation feedback must not hold a request permit or corrupt state.
    }
  }

  private completeVerificationRun(
    candidateId: CandidateId,
    run: VerificationRun,
    resolution: CandidateMoveVerificationResolution,
  ) {
    this.activeNetworkCandidateIds.delete(candidateId)
    this.activeRequestCount -= 1

    if (this.verificationRunByCandidateId.get(candidateId) === run) {
      this.verificationRunByCandidateId.delete(candidateId)
      run.resolve(resolution)
    }

    this.publish()
    this.pump()
  }

  private pump() {
    while (
      this.activeRequestCount < this.maxConcurrency &&
      this.readyQueue.length > 0
    ) {
      const nextTaskIndex = this.readyQueue.findIndex(
        ({ candidateId }) => !this.activeNetworkCandidateIds.has(candidateId),
      )

      if (nextTaskIndex === -1) {
        return
      }

      const task = this.readyQueue.splice(nextTaskIndex, 1)[0]

      if (task === undefined) {
        return
      }

      const { candidateId } = task

      if (task.kind === 'verification') {
        const run = this.verificationRunByCandidateId.get(candidateId)
        const verification =
          this.verificationRequiredByCandidateId.get(candidateId)

        if (
          run === undefined ||
          run.attemptedMutationId !== task.attemptedMutationId
        ) {
          continue
        }

        if (
          verification?.attemptedCommand.clientMutationId !==
          task.attemptedMutationId
        ) {
          this.verificationRunByCandidateId.delete(candidateId)
          run.resolve({ candidateId, status: 'not-required' })
          this.publish()
          continue
        }

        this.activeNetworkCandidateIds.add(candidateId)
        this.activeRequestCount += 1
        void this.resolveVerification(verification).then((resolution) => {
          this.completeVerificationRun(candidateId, run, resolution)
        })
        continue
      }

      const lane = this.lanes.get(candidateId)

      if (lane?.phase !== 'ready') {
        continue
      }

      const confirmedCandidate = this.readConfirmedCandidate(candidateId)

      if (confirmedCandidate === undefined) {
        this.lanes.delete(candidateId)
        const failure = this.createFailure(
          lane.intent,
          new MoveExecutionError({
            kind: 'failed',
            safeMessage: CANDIDATE_UNAVAILABLE_MESSAGE,
          }),
        )

        this.failureByCandidateId.set(candidateId, failure)
        this.lastResultByCandidateId.set(candidateId, failure)
        this.publishAndNotify(failure)
        continue
      }

      if (confirmedCandidate.currentStage === lane.intent.targetStage) {
        this.lanes.delete(candidateId)
        this.completeWithoutRequest(lane.intent, confirmedCandidate)
        continue
      }

      const command = this.createCommand(
        lane.intent.candidateId,
        lane.intent.targetStage,
        confirmedCandidate,
      )

      this.lanes.set(candidateId, {
        command,
        intent: lane.intent,
        phase: 'sending',
      })
      this.activeNetworkCandidateIds.add(candidateId)
      this.activeRequestCount += 1
      void this.runOperation(command).then((runResult) => {
        this.completeOperation(candidateId, command, runResult)
      })
    }
  }

  private readConfirmedCandidate(candidateId: CandidateId) {
    const readCandidate = this.adapters.readConfirmedCandidate(candidateId)
    const knownCandidate = this.knownConfirmedByCandidateId.get(candidateId)

    if (readCandidate === undefined) {
      return knownCandidate
    }

    if (
      knownCandidate !== undefined &&
      knownCandidate.revision >= readCandidate.revision
    ) {
      return knownCandidate
    }

    this.knownConfirmedByCandidateId.set(candidateId, readCandidate)
    return readCandidate
  }

  private async resolveVerification(
    verification: CandidateMoveVerificationRequired,
  ): Promise<CandidateMoveVerificationResolution> {
    try {
      const reconciledCandidate = this.acceptConfirmedCandidate(
        await this.adapters.reconcile(verification.candidateId),
      )

      if (!this.isCurrentVerification(verification)) {
        return {
          candidateId: verification.candidateId,
          status: 'not-required',
        }
      }

      if (
        reconciledCandidate.currentStage === verification.intent.targetStage
      ) {
        this.clearTerminalState(verification.candidateId)
        const result: CandidateMoveSuccess = {
          candidate: reconciledCandidate,
          candidateId: verification.candidateId,
          completedAt: this.now(),
          intent: verification.intent,
          status: 'success',
        }

        this.lastResultByCandidateId.set(verification.candidateId, result)
        this.publishAndNotify(result)

        return { result, status: 'resolved' }
      }

      this.clearTerminalState(verification.candidateId)

      return {
        status: 'resubmitted',
        submission: this.submit(verification.intent),
      }
    } catch (error) {
      if (!this.isCurrentVerification(verification)) {
        return {
          candidateId: verification.candidateId,
          status: 'not-required',
        }
      }

      const normalizedError = asExecutionError(error)

      const nextVerification: CandidateMoveVerificationRequired = {
        ...verification,
        completedAt: this.now(),
        safeMessage: normalizedError.safeMessage,
      }

      this.verificationRequiredByCandidateId.set(
        verification.candidateId,
        nextVerification,
      )
      this.lastResultByCandidateId.set(
        verification.candidateId,
        nextVerification,
      )
      this.publishAndNotify(nextVerification)

      return {
        result: nextVerification,
        status: 'verification-required',
      }
    }
  }

  private isCurrentVerification(
    verification: CandidateMoveVerificationRequired,
  ) {
    return (
      this.verificationRequiredByCandidateId.get(verification.candidateId)
        ?.attemptedCommand.clientMutationId ===
      verification.attemptedCommand.clientMutationId
    )
  }

  private async runOperation(
    initialCommand: CandidateMoveCommand,
  ): Promise<OperationRunResult> {
    let command = initialCommand
    let hasRebasedRevisionConflict = false

    while (true) {
      const outcome = await this.attemptCommand(command)

      if (
        outcome.status !== 'failure' ||
        outcome.error.kind !== 'revision-conflict' ||
        hasRebasedRevisionConflict
      ) {
        return { attemptedCommand: command, outcome }
      }

      hasRebasedRevisionConflict = true

      try {
        const reconciledCandidate = this.acceptConfirmedCandidate(
          await this.adapters.reconcile(command.candidateId),
        )

        if (reconciledCandidate.currentStage === command.targetStage) {
          return {
            attemptedCommand: command,
            outcome: { candidate: reconciledCandidate, status: 'success' },
          }
        }

        command = this.createCommand(
          command.candidateId,
          command.targetStage,
          reconciledCandidate,
        )
      } catch (reconcileError) {
        return {
          attemptedCommand: command,
          outcome: {
            error: asExecutionError(reconcileError),
            status: 'failure',
          },
        }
      }
    }
  }
}

export function createCandidateMovementCoordinator(
  adapters: CandidateMovementAdapters,
  options?: CandidateMovementCoordinatorOptions,
) {
  return new CandidateMovementCoordinator(adapters, options)
}
