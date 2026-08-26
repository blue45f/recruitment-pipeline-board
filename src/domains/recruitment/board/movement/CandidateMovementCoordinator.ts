import type {
  Candidate,
  CandidateId,
  CandidateStage,
} from '../../candidates/model'

const DEFAULT_FAILURE_MESSAGE = '단계 변경을 저장하지 못했습니다.'
const CANDIDATE_UNAVAILABLE_MESSAGE = '후보자의 최신 정보를 확인할 수 없습니다.'
const UNDO_STALE_MESSAGE = '이후 단계가 변경되어 되돌릴 수 없습니다.'

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
  compensatesClientMutationId?: string
}>

export type CandidateMoveExecutionReceipt = Readonly<{
  candidateId: CandidateId
  clientMutationId: string
  committedRevision: number
  committedStage: CandidateStage
  previousStage: CandidateStage
}>

export type CandidateMoveExecution = Readonly<{
  candidate: Candidate
  undoReceipt?: CandidateMoveExecutionReceipt
}>

export type MoveExecutionErrorKind =
  | 'failed'
  | 'idempotency-conflict'
  | 'revision-conflict'
  | 'undo-unavailable'
  | 'unknown-outcome'

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
  undoReceipt?: CandidateUndoReceipt
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
  intentOrder: number
  projectedStage: CandidateStage
  safeMessage: string
  status: 'verification-required'
}>

export type CandidateMoveResult =
  | CandidateMoveFailure
  | CandidateMoveSuccess
  | CandidateMoveVerificationRequired

export type CandidateUndoReceipt = Readonly<{
  candidateId: CandidateId
  candidateName: string
  completedAt: number
  fromStage: CandidateStage
  intentOrder: number
  resultRevision: number
  sourceClientMutationId: string
  toStage: CandidateStage
}>

export type CandidateUndoAvailable = Readonly<{
  receipt: CandidateUndoReceipt
  status: 'available'
}>

type CandidateUndoPending = Readonly<{
  phase: 'queued' | 'sending'
  receipt: CandidateUndoReceipt
  status: 'pending'
}>

export type CandidateUndoFailureState = Readonly<{
  receipt: CandidateUndoReceipt
  safeMessage: string
  status: 'failure'
}>

export type CandidateUndoVerificationRequired = Readonly<{
  attemptedCommand: CandidateMoveCommand
  receipt: CandidateUndoReceipt
  safeMessage: string
  status: 'verification-required'
}>

export type CandidateUndoState =
  | CandidateUndoAvailable
  | CandidateUndoFailureState
  | CandidateUndoPending
  | CandidateUndoVerificationRequired

export type CandidateUndoSuccess = Readonly<{
  candidate: Candidate
  candidateId: CandidateId
  completedAt: number
  receipt: CandidateUndoReceipt
  status: 'undo-success'
}>

export type CandidateUndoFailure = Readonly<{
  candidateId: CandidateId
  completedAt: number
  currentStage: CandidateStage
  kind: MoveExecutionErrorKind | 'stale'
  receipt: CandidateUndoReceipt
  retryable: boolean
  safeMessage: string
  status: 'undo-failure'
}>

export type CandidateUndoVerificationResult = Readonly<{
  candidateId: CandidateId
  completedAt: number
  receipt: CandidateUndoReceipt
  safeMessage: string
  status: 'undo-verification-required'
}>

export type CandidateUndoResult =
  CandidateUndoFailure | CandidateUndoSuccess | CandidateUndoVerificationResult

export type CandidateMovementNotification =
  CandidateMoveResult | CandidateUndoResult

export type CandidateUndoSubmission =
  | Readonly<{
      accepted: true
      candidateId: CandidateId
      completion: Promise<CandidateUndoResult>
      disposition: 'queued' | 'started'
    }>
  | Readonly<{
      accepted: false
      candidateId?: CandidateId
      reason: 'already-consuming' | 'candidate-busy' | 'stale' | 'unavailable'
    }>

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
  undoPendingCandidateIds: ReadonlySet<CandidateId>
  undoState: CandidateUndoState | undefined
  verificationPendingCandidateIds: ReadonlySet<CandidateId>
  verificationRequiredByCandidateId: ReadonlyMap<
    CandidateId,
    CandidateMoveVerificationRequired
  >
  version: number
}>

export type CandidateMovementAdapters = Readonly<{
  execute: (command: CandidateMoveCommand) => Promise<CandidateMoveExecution>
  mergeConfirmed: (candidate: Candidate) => void
  notify: (result: CandidateMovementNotification) => void
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
        | 'undo-in-progress'
    }>

type ReadyLane = Readonly<{
  intent: OrderedCandidateMoveIntent
  phase: 'ready'
}>

type SendingLane = Readonly<{
  command: CandidateMoveCommand
  intent: OrderedCandidateMoveIntent
  phase: 'sending'
  queuedIntent?: OrderedCandidateMoveIntent
}>

type CandidateLane = ReadyLane | SendingLane

type OrderedCandidateMoveIntent = CandidateMoveIntent &
  Readonly<{
    order: number
  }>

type OperationSuccess = Readonly<{
  candidate: Candidate
  undoReceipt?: CandidateMoveExecutionReceipt
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

type UndoReadyTask = Readonly<{
  candidateId: CandidateId
  kind: 'undo'
  runId: string
}>

type ReadyTask = MoveReadyTask | UndoReadyTask | VerificationReadyTask

type VerificationRun = Readonly<{
  attemptedMutationId: string
  promise: Promise<CandidateMoveVerificationResolution>
  resolve: (resolution: CandidateMoveVerificationResolution) => void
}>

type UndoRun = Readonly<{
  command: CandidateMoveCommand
  isVerification: boolean
  promise: Promise<CandidateUndoResult>
  receipt: CandidateUndoReceipt
  resolve: (resolution: CandidateUndoResult) => void
  runId: string
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

function publicIntent(intent: OrderedCandidateMoveIntent): CandidateMoveIntent {
  return cloneIntent(intent)
}

function createEmptySnapshot(): CandidateMovementSnapshot {
  return {
    failureByCandidateId: new Map(),
    lastResultByCandidateId: new Map(),
    pendingCandidateIds: new Set(),
    stageProjectionByCandidateId: new Map(),
    undoPendingCandidateIds: new Set(),
    undoState: undefined,
    verificationPendingCandidateIds: new Set(),
    verificationRequiredByCandidateId: new Map(),
    version: 0,
  }
}

function createUndoRun(
  command: CandidateMoveCommand,
  receipt: CandidateUndoReceipt,
  runId: string,
  isVerification: boolean,
): UndoRun {
  let resolveRun: (resolution: CandidateUndoResult) => void = () => undefined
  const promise = new Promise<CandidateUndoResult>((resolve) => {
    resolveRun = resolve
  })

  return {
    command,
    isVerification,
    promise,
    receipt,
    resolve: resolveRun,
    runId,
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
  private latestForwardIntentOrder = 0
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
  private deferredUndoReceipt: CandidateUndoReceipt | undefined
  private undoRun: UndoRun | undefined
  private undoRunSequence = 0
  private undoState: CandidateUndoState | undefined

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
    const candidateId = intent.candidateId

    if (this.isUndoBlockingCandidate(candidateId)) {
      return {
        accepted: false,
        candidateId,
        reason: 'undo-in-progress',
      }
    }

    const existingLane = this.lanes.get(candidateId)

    if (existingLane?.phase === 'ready') {
      if (existingLane.intent.targetStage === intent.targetStage) {
        return this.duplicateSubmission(candidateId)
      }

      const nextIntent = this.createOrderedForwardIntent(intent)

      this.clearTerminalState(candidateId)
      this.lanes.set(candidateId, {
        intent: nextIntent,
        phase: 'ready',
      })
      this.publish()
      this.pump()

      return {
        accepted: true,
        candidateId,
        disposition: 'replaced-ready',
      }
    }

    if (existingLane?.phase === 'sending') {
      const visibleTarget =
        existingLane.queuedIntent?.targetStage ??
        existingLane.intent.targetStage

      if (visibleTarget === intent.targetStage) {
        return this.duplicateSubmission(candidateId)
      }

      const nextIntent = this.createOrderedForwardIntent(intent)

      this.clearTerminalState(candidateId)
      this.lanes.set(candidateId, {
        ...existingLane,
        queuedIntent: nextIntent,
      })
      this.publish()

      return {
        accepted: true,
        candidateId,
        disposition: 'queued',
      }
    }

    const confirmedCandidate = this.readConfirmedCandidate(candidateId)

    if (confirmedCandidate === undefined) {
      return {
        accepted: false,
        candidateId,
        reason: 'candidate-unavailable',
      }
    }

    const stickyProjection = this.stickyProjectionByCandidateId.get(candidateId)
    const visibleTarget = stickyProjection ?? confirmedCandidate.currentStage

    if (visibleTarget === intent.targetStage) {
      return this.duplicateSubmission(candidateId)
    }

    const nextIntent = this.createOrderedForwardIntent(intent)

    this.clearTerminalState(candidateId)
    this.lanes.set(candidateId, {
      intent: nextIntent,
      phase: 'ready',
    })
    this.readyQueue.push({
      candidateId,
      kind: 'move',
    })
    this.publish()
    this.pump()

    const disposition =
      this.lanes.get(candidateId)?.phase === 'sending' ? 'started' : 'queued'

    return {
      accepted: true,
      candidateId,
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

  readonly verify = (
    candidateId: CandidateId,
  ): Promise<CandidateMoveVerificationResolution> => {
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

  readonly undoLatest = (): CandidateUndoSubmission => {
    const state = this.undoState

    if (state === undefined) {
      return { accepted: false, reason: 'unavailable' }
    }

    const { candidateId } = state.receipt

    if (state.status === 'pending') {
      return {
        accepted: false,
        candidateId,
        reason: 'already-consuming',
      }
    }

    if (
      this.lanes.has(candidateId) ||
      this.activeNetworkCandidateIds.has(candidateId)
    ) {
      return {
        accepted: false,
        candidateId,
        reason: 'candidate-busy',
      }
    }

    const confirmedCandidate = this.readConfirmedCandidate(candidateId)

    if (
      state.status !== 'verification-required' &&
      !this.receiptMatchesCandidate(state.receipt, confirmedCandidate)
    ) {
      this.undoState = undefined
      const staleResult = this.createUndoFailure(
        state.receipt,
        'stale',
        UNDO_STALE_MESSAGE,
        confirmedCandidate,
        false,
      )

      this.publishAndNotify(staleResult)

      return { accepted: false, candidateId, reason: 'stale' }
    }

    const command =
      state.status === 'verification-required'
        ? state.attemptedCommand
        : {
            candidateId,
            clientMutationId: this.createId(),
            compensatesClientMutationId: state.receipt.sourceClientMutationId,
            expectedRevision: state.receipt.resultRevision,
            targetStage: state.receipt.fromStage,
          }
    const runId = `${command.clientMutationId}:${++this.undoRunSequence}`
    const run = createUndoRun(
      command,
      state.receipt,
      runId,
      state.status === 'verification-required',
    )

    this.undoRun = run
    this.undoState = {
      phase: 'queued',
      receipt: state.receipt,
      status: 'pending',
    }
    this.readyQueue.push({ candidateId, kind: 'undo', runId })
    this.publish()
    this.pump()

    return {
      accepted: true,
      candidateId,
      completion: run.promise,
      disposition:
        this.undoState?.status === 'pending' &&
        this.undoState.phase === 'sending'
          ? 'started'
          : 'queued',
    }
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
      const execution = await this.adapters.execute(command)

      return {
        ...execution,
        status: 'success',
      }
    } catch (firstError) {
      const normalizedFirstError = asExecutionError(firstError)

      if (normalizedFirstError.kind !== 'unknown-outcome') {
        return { error: normalizedFirstError, status: 'failure' }
      }

      try {
        const replayedExecution = await this.adapters.execute(command)

        return {
          ...replayedExecution,
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

  private createOrderedForwardIntent(
    intent: CandidateMoveIntent,
  ): OrderedCandidateMoveIntent {
    this.latestForwardIntentOrder += 1
    this.deferredUndoReceipt = undefined

    if (
      this.undoState?.status === 'available' ||
      this.undoState?.status === 'failure'
    ) {
      this.undoState = undefined
    }

    return {
      ...cloneIntent(intent),
      order: this.latestForwardIntentOrder,
    }
  }

  private isUndoBlockingCandidate(candidateId: CandidateId) {
    return (
      (this.undoState?.status === 'pending' ||
        this.undoState?.status === 'verification-required') &&
      this.undoState.receipt.candidateId === candidateId
    )
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
      const result = this.createMoveSuccess(
        lane.intent,
        attemptedCommand,
        confirmedCandidate ?? outcome.candidate,
        outcome.undoReceipt,
      )

      this.lastResultByCandidateId.set(candidateId, result)
      this.publishAndNotify(result)
      this.pump()
      return
    }

    if (outcome.status === 'verification-required') {
      const projectedIntent = lane.queuedIntent ?? lane.intent
      const result: CandidateMoveVerificationRequired = {
        attemptedCommand,
        attemptedIntent: publicIntent(lane.intent),
        candidateId,
        candidateName: projectedIntent.candidateName,
        completedAt: this.now(),
        intent: publicIntent(projectedIntent),
        intentOrder: projectedIntent.order,
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
      intent: cloneIntent(intent),
      status: 'success',
    }

    this.lastResultByCandidateId.set(intent.candidateId, result)
    this.publishAndNotify(result)
  }

  private createMoveSuccess(
    intent: OrderedCandidateMoveIntent,
    command: CandidateMoveCommand,
    candidate: Candidate,
    executionReceipt?: CandidateMoveExecutionReceipt,
  ): CandidateMoveSuccess {
    const completedAt = this.now()
    const canCreateUndoReceipt =
      executionReceipt !== undefined &&
      command.compensatesClientMutationId === undefined &&
      intent.order === this.latestForwardIntentOrder &&
      executionReceipt.candidateId === candidate.id &&
      executionReceipt.candidateId === command.candidateId &&
      executionReceipt.clientMutationId === command.clientMutationId &&
      executionReceipt.committedStage === candidate.currentStage &&
      executionReceipt.committedStage === command.targetStage &&
      executionReceipt.committedRevision === candidate.revision &&
      executionReceipt.committedRevision === command.expectedRevision + 1 &&
      executionReceipt.previousStage !== executionReceipt.committedStage
    const undoReceipt = canCreateUndoReceipt
      ? {
          candidateId: candidate.id,
          candidateName: intent.candidateName,
          completedAt,
          fromStage: executionReceipt.previousStage,
          intentOrder: intent.order,
          resultRevision: executionReceipt.committedRevision,
          sourceClientMutationId: executionReceipt.clientMutationId,
          toStage: executionReceipt.committedStage,
        }
      : undefined

    if (undoReceipt !== undefined) {
      if (
        this.undoState?.status === 'pending' ||
        this.undoState?.status === 'verification-required'
      ) {
        this.deferredUndoReceipt = undoReceipt
      } else {
        this.deferredUndoReceipt = undefined
        this.undoState = { receipt: undoReceipt, status: 'available' }
      }
    }

    return {
      candidate,
      candidateId: intent.candidateId,
      completedAt,
      intent: publicIntent(intent),
      status: 'success',
      ...(undoReceipt === undefined ? {} : { undoReceipt }),
    }
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
      intent: cloneIntent(intent),
      kind: error.kind,
      safeMessage: error.safeMessage,
      status: 'failure',
      targetStage: intent.targetStage,
    }
  }

  private createUndoFailure(
    receipt: CandidateUndoReceipt,
    kind: MoveExecutionErrorKind | 'stale',
    safeMessage: string,
    candidate: Candidate | undefined,
    retryable: boolean,
  ): CandidateUndoFailure {
    return {
      candidateId: receipt.candidateId,
      completedAt: this.now(),
      currentStage: candidate?.currentStage ?? receipt.toStage,
      kind,
      receipt,
      retryable,
      safeMessage,
      status: 'undo-failure',
    }
  }

  private receiptMatchesCandidate(
    receipt: CandidateUndoReceipt,
    candidate: Candidate | undefined,
  ) {
    return (
      candidate?.id === receipt.candidateId &&
      candidate.currentStage === receipt.toStage &&
      candidate.revision === receipt.resultRevision
    )
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

  private takeDeferredUndoState(): CandidateUndoAvailable | undefined {
    const receipt = this.deferredUndoReceipt

    this.deferredUndoReceipt = undefined

    if (
      receipt?.intentOrder !== this.latestForwardIntentOrder ||
      !this.receiptMatchesCandidate(
        receipt,
        this.readConfirmedCandidate(receipt.candidateId),
      )
    ) {
      return undefined
    }

    return { receipt, status: 'available' }
  }

  private publish() {
    const previousSnapshot = this.snapshot
    const pendingCandidateIds = new Set(this.lanes.keys())
    const undoPendingCandidateIds = new Set<CandidateId>()
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

    if (
      this.undoState?.status === 'pending' ||
      this.undoState?.status === 'verification-required'
    ) {
      stageProjectionByCandidateId.set(
        this.undoState.receipt.candidateId,
        this.undoState.receipt.fromStage,
      )
    }

    if (this.undoState?.status === 'pending') {
      pendingCandidateIds.add(this.undoState.receipt.candidateId)
      undoPendingCandidateIds.add(this.undoState.receipt.candidateId)
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
      undoPendingCandidateIds: reuseSetIfEqual(
        undoPendingCandidateIds,
        previousSnapshot.undoPendingCandidateIds,
      ),
      undoState: this.undoState,
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

  private publishAndNotify(result: CandidateMovementNotification) {
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

      if (task.kind === 'verification') {
        this.startVerificationTask(task)
        continue
      }

      if (task.kind === 'undo') {
        this.startUndoTask(task)
        continue
      }

      this.startMoveTask(task)
    }
  }

  private startUndoTask(task: UndoReadyTask) {
    const run = this.undoRun

    if (
      run?.runId !== task.runId ||
      this.undoState?.status !== 'pending' ||
      this.undoState.receipt.sourceClientMutationId !==
        run.receipt.sourceClientMutationId
    ) {
      return
    }

    const candidate = this.readConfirmedCandidate(task.candidateId)

    if (
      !run.isVerification &&
      !this.receiptMatchesCandidate(run.receipt, candidate)
    ) {
      this.undoRun = undefined
      this.undoState = this.takeDeferredUndoState()
      const result = this.createUndoFailure(
        run.receipt,
        'stale',
        UNDO_STALE_MESSAGE,
        candidate,
        false,
      )

      run.resolve(result)
      this.publishAndNotify(result)
      return
    }

    this.undoState = {
      phase: 'sending',
      receipt: run.receipt,
      status: 'pending',
    }
    this.activeNetworkCandidateIds.add(task.candidateId)
    this.activeRequestCount += 1
    this.publish()
    void this.runUndoOperation(run.command).then((outcome) => {
      this.completeUndoOperation(run, outcome)
    })
  }

  private startVerificationTask(task: VerificationReadyTask) {
    const { candidateId } = task
    const run = this.verificationRunByCandidateId.get(candidateId)
    const verification = this.verificationRequiredByCandidateId.get(candidateId)

    if (run?.attemptedMutationId !== task.attemptedMutationId) {
      return
    }

    if (
      verification?.attemptedCommand.clientMutationId !==
      task.attemptedMutationId
    ) {
      this.verificationRunByCandidateId.delete(candidateId)
      run.resolve({ candidateId, status: 'not-required' })
      this.publish()
      return
    }

    this.activeNetworkCandidateIds.add(candidateId)
    this.activeRequestCount += 1
    void this.resolveVerification(verification).then((resolution) => {
      this.completeVerificationRun(candidateId, run, resolution)
    })
  }

  private completeUndoOperation(run: UndoRun, outcome: OperationOutcome) {
    const { candidateId } = run.receipt

    this.activeNetworkCandidateIds.delete(candidateId)
    this.activeRequestCount -= 1

    if (this.undoRun?.runId !== run.runId) {
      this.pump()
      return
    }

    this.undoRun = undefined

    if (outcome.status === 'success') {
      const candidate = this.acceptConfirmedCandidate(outcome.candidate)
      const result: CandidateUndoSuccess = {
        candidate,
        candidateId,
        completedAt: this.now(),
        receipt: run.receipt,
        status: 'undo-success',
      }

      this.undoState = this.takeDeferredUndoState()
      run.resolve(result)
      this.publishAndNotify(result)
      this.pump()
      return
    }

    if (outcome.status === 'verification-required') {
      const result: CandidateUndoVerificationResult = {
        candidateId,
        completedAt: this.now(),
        receipt: run.receipt,
        safeMessage: outcome.error.safeMessage,
        status: 'undo-verification-required',
      }

      this.undoState = {
        attemptedCommand: run.command,
        receipt: run.receipt,
        safeMessage: outcome.error.safeMessage,
        status: 'verification-required',
      }
      run.resolve(result)
      this.publishAndNotify(result)
      this.pump()
      return
    }

    const currentCandidate = this.readConfirmedCandidate(candidateId)
    const wasSuperseded =
      run.receipt.intentOrder < this.latestForwardIntentOrder
    const retryable =
      !wasSuperseded &&
      outcome.error.kind === 'failed' &&
      this.receiptMatchesCandidate(run.receipt, currentCandidate)
    const result = this.createUndoFailure(
      run.receipt,
      outcome.error.kind,
      outcome.error.safeMessage,
      currentCandidate,
      retryable,
    )

    this.undoState = retryable
      ? {
          receipt: run.receipt,
          safeMessage: outcome.error.safeMessage,
          status: 'failure',
        }
      : this.takeDeferredUndoState()
    run.resolve(result)
    this.publishAndNotify(result)
    this.pump()
  }

  private startMoveTask(task: MoveReadyTask) {
    const { candidateId } = task
    const lane = this.lanes.get(candidateId)

    if (lane?.phase !== 'ready') {
      return
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
      return
    }

    if (confirmedCandidate.currentStage === lane.intent.targetStage) {
      this.lanes.delete(candidateId)
      this.completeWithoutRequest(lane.intent, confirmedCandidate)
      return
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

  private async runUndoOperation(
    command: CandidateMoveCommand,
  ): Promise<OperationOutcome> {
    const outcome = await this.attemptCommand(command)
    const shouldReconcileFailedUndo =
      outcome.status === 'failure' &&
      (outcome.error.kind === 'revision-conflict' ||
        outcome.error.kind === 'undo-unavailable')

    if (shouldReconcileFailedUndo) {
      try {
        this.acceptConfirmedCandidate(
          await this.adapters.reconcile(command.candidateId),
        )
      } catch {
        // The fixed-revision compensation remains failed. A best-effort read is
        // only used to show the newest confirmed stage and never to rebase Undo.
      }
    }

    return outcome
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
