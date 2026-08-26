import { z } from 'zod'

import {
  candidateIdSchema,
  candidateSchema,
  candidateStageSchema,
  clientMutationIdSchema,
  generateCandidateFixtures,
  type Candidate,
  type CandidateId,
  type CandidateListSize,
  type CandidateStage,
} from '../../model'
import type { CandidateMockStorage } from './candidateMockStorage'

const STORAGE_VERSION = 2 as const
const DEFAULT_FIXTURE_SEED = 20260826

export const CANDIDATE_MOCK_RECEIPT_LIMIT = 512
export const CANDIDATE_MOCK_RECEIPT_TTL_MS = 24 * 60 * 60 * 1_000

const persistedMutationSchema = z
  .object({
    currentStage: candidateStageSchema,
    stageChangedAt: z.iso.datetime({ offset: true }),
    revision: z.number().int().nonnegative(),
  })
  .strict()

const legacyPersistedEnvelopeSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(0).max(0xffff_ffff),
    mutations: z.record(candidateIdSchema, persistedMutationSchema),
  })
  .strict()

const persistedStageReceiptSchema = z
  .object({
    clientMutationId: clientMutationIdSchema,
    candidateId: candidateIdSchema,
    currentStage: candidateStageSchema,
    expectedRevision: z.number().int().nonnegative(),
    requestId: z.string().trim().min(1).max(100),
    committedAt: z.iso.datetime({ offset: true }),
    candidate: candidateSchema,
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.candidate.id !== receipt.candidateId) {
      context.addIssue({
        code: 'custom',
        message: 'receipt 후보자 ID가 요청과 다릅니다.',
        path: ['candidate', 'id'],
      })
    }

    if (receipt.candidate.currentStage !== receipt.currentStage) {
      context.addIssue({
        code: 'custom',
        message: 'receipt 후보자 단계가 요청과 다릅니다.',
        path: ['candidate', 'currentStage'],
      })
    }

    if (receipt.candidate.revision !== receipt.expectedRevision + 1) {
      context.addIssue({
        code: 'custom',
        message: 'receipt 후보자 revision이 요청과 이어지지 않습니다.',
        path: ['candidate', 'revision'],
      })
    }
  })

const persistedEnvelopeSchema = z
  .object({
    version: z.literal(STORAGE_VERSION),
    seed: z.number().int().min(0).max(0xffff_ffff),
    mutations: z.record(candidateIdSchema, persistedMutationSchema),
    receipts: z.record(clientMutationIdSchema, persistedStageReceiptSchema),
  })
  .strict()
  .superRefine((envelope, context) => {
    const entries = Object.entries(envelope.receipts)

    if (entries.length > CANDIDATE_MOCK_RECEIPT_LIMIT) {
      context.addIssue({
        code: 'too_big',
        maximum: CANDIDATE_MOCK_RECEIPT_LIMIT,
        origin: 'object',
        path: ['receipts'],
      })
    }

    for (const [clientMutationId, receipt] of entries) {
      if (receipt.clientMutationId !== clientMutationId) {
        context.addIssue({
          code: 'custom',
          message: 'receipt 키가 clientMutationId와 다릅니다.',
          path: ['receipts', clientMutationId, 'clientMutationId'],
        })
      }
    }
  })

type PersistedEnvelope = z.infer<typeof persistedEnvelopeSchema>
export type CandidateStageReceipt = z.infer<typeof persistedStageReceiptSchema>

export type CandidateMockRepository = ReturnType<
  typeof createCandidateMockRepository
>

export type CandidateStageReceiptLookupResult =
  | { status: 'none' }
  | {
      status: 'replayed'
      candidate: Candidate
      receipt: CandidateStageReceipt
    }
  | {
      status: 'idempotency-conflict'
      receipt: CandidateStageReceipt
    }

export type CandidateStageCommitResult =
  | {
      status: 'updated' | 'replayed'
      candidate: Candidate
      receipt: CandidateStageReceipt
    }
  | { status: 'not-found' }
  | { status: 'revision-conflict'; candidate: Candidate }
  | {
      status: 'idempotency-conflict'
      receipt: CandidateStageReceipt
    }

type CandidateStageExclusiveCommitResult =
  CandidateStageCommitResult | { status: 'transient-rejection' }

type CreateCandidateMockRepositoryOptions = {
  storage: CandidateMockStorage
  seed?: number
  receiptTtlMs?: number
}

type CandidateStageOperationIdentity = {
  candidateId: CandidateId
  currentStage: CandidateStage
  expectedRevision: number
  clientMutationId: string
}

type LookupCandidateStageReceiptInput = CandidateStageOperationIdentity & {
  checkedAt: string
}

type IdempotentCommitCandidateStageInput = CandidateStageOperationIdentity & {
  requestId: string
  stageChangedAt: string
  committedAt: string
}

type LegacyCommitCandidateStageInput = Omit<
  CandidateStageOperationIdentity,
  'clientMutationId'
> & {
  stageChangedAt: string
}

type CommitCandidateStageInput =
  IdempotentCommitCandidateStageInput | LegacyCommitCandidateStageInput

function emptyEnvelope(seed: number): PersistedEnvelope {
  return { version: STORAGE_VERSION, seed, mutations: {}, receipts: {} }
}

function parseEnvelope(value: string | null, seed: number) {
  if (value === null) {
    return emptyEnvelope(seed)
  }

  try {
    const rawEnvelope: unknown = JSON.parse(value)
    const parsed = persistedEnvelopeSchema.safeParse(rawEnvelope)

    if (parsed.success && parsed.data.seed === seed) {
      return parsed.data
    }

    const legacy = legacyPersistedEnvelopeSchema.safeParse(rawEnvelope)

    if (legacy.success && legacy.data.seed === seed) {
      // v1 did not persist idempotency receipts. Preserve its validated stage
      // overlays and start receipt tracking from the first subsequent commit.
      return {
        version: STORAGE_VERSION,
        seed,
        mutations: legacy.data.mutations,
        receipts: {},
      }
    }

    return emptyEnvelope(seed)
  } catch {
    return emptyEnvelope(seed)
  }
}

function applyMutation(
  candidate: Candidate,
  envelope: PersistedEnvelope,
): Candidate {
  const mutation = envelope.mutations[candidate.id]

  if (mutation === undefined) {
    return candidate
  }

  const parsed = candidateSchema.safeParse({ ...candidate, ...mutation })

  return parsed.success ? parsed.data : candidate
}

function isReceiptActive(
  receipt: CandidateStageReceipt,
  checkedAt: string,
  receiptTtlMs: number,
) {
  return Date.parse(receipt.committedAt) + receiptTtlMs > Date.parse(checkedAt)
}

function operationMatchesReceipt(
  operation: CandidateStageOperationIdentity,
  receipt: CandidateStageReceipt,
) {
  return (
    operation.candidateId === receipt.candidateId &&
    operation.currentStage === receipt.currentStage &&
    operation.expectedRevision === receipt.expectedRevision
  )
}

function lookupReceipt(
  envelope: PersistedEnvelope,
  operation: CandidateStageOperationIdentity,
  checkedAt: string,
  receiptTtlMs: number,
): CandidateStageReceiptLookupResult {
  const receipt = envelope.receipts[operation.clientMutationId]

  if (
    receipt === undefined ||
    !isReceiptActive(receipt, checkedAt, receiptTtlMs)
  ) {
    return { status: 'none' }
  }

  if (!operationMatchesReceipt(operation, receipt)) {
    return { status: 'idempotency-conflict', receipt }
  }

  return { status: 'replayed', candidate: receipt.candidate, receipt }
}

function retainRecentReceipts(
  receipts: PersistedEnvelope['receipts'],
  nextReceipt: CandidateStageReceipt,
  checkedAt: string,
  receiptTtlMs: number,
) {
  const recentEntries = Object.entries(receipts)
    .filter(
      ([clientMutationId, receipt]) =>
        clientMutationId !== nextReceipt.clientMutationId &&
        isReceiptActive(receipt, checkedAt, receiptTtlMs),
    )
    .sort(
      ([firstId, first], [secondId, second]) =>
        Date.parse(second.committedAt) - Date.parse(first.committedAt) ||
        secondId.localeCompare(firstId),
    )
    .slice(0, CANDIDATE_MOCK_RECEIPT_LIMIT - 1)

  return Object.fromEntries([
    ...recentEntries,
    [nextReceipt.clientMutationId, nextReceipt],
  ])
}

function normalizeCommitInput(
  input: CommitCandidateStageInput,
): IdempotentCommitCandidateStageInput {
  if ('clientMutationId' in input) {
    return input
  }

  return {
    ...input,
    clientMutationId: [
      'legacy',
      input.candidateId.slice(0, 48),
      input.currentStage,
      input.expectedRevision,
    ].join('-'),
    requestId: 'legacy-repository-commit',
    committedAt: input.stageChangedAt,
  }
}

export function createCandidateMockRepository({
  storage,
  seed = DEFAULT_FIXTURE_SEED,
  receiptTtlMs = CANDIDATE_MOCK_RECEIPT_TTL_MS,
}: CreateCandidateMockRepositoryOptions) {
  const candidates = generateCandidateFixtures({ seed, size: 1_000 })
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  )

  function readEnvelope() {
    return parseEnvelope(storage.read(), seed)
  }

  function getById(candidateId: CandidateId) {
    const candidate = candidatesById.get(candidateId)

    if (candidate === undefined) {
      return undefined
    }

    return applyMutation(candidate, readEnvelope())
  }

  function commitStageFromEnvelope(
    input: CommitCandidateStageInput,
    envelope: PersistedEnvelope,
    rejectNewCommit = false,
  ): CandidateStageExclusiveCommitResult {
    const {
      candidateId,
      currentStage,
      expectedRevision,
      clientMutationId,
      requestId,
      stageChangedAt,
      committedAt,
    } = normalizeCommitInput(input)
    const operation = {
      candidateId,
      currentStage,
      expectedRevision,
      clientMutationId,
    }
    const receiptResult = lookupReceipt(
      envelope,
      operation,
      committedAt,
      receiptTtlMs,
    )

    if (receiptResult.status !== 'none') {
      return receiptResult
    }

    const baseCandidate = candidatesById.get(candidateId)

    if (baseCandidate === undefined) {
      return { status: 'not-found' }
    }

    const currentCandidate = applyMutation(baseCandidate, envelope)

    if (currentCandidate.revision !== expectedRevision) {
      return { status: 'revision-conflict', candidate: currentCandidate }
    }

    if (rejectNewCommit) {
      return { status: 'transient-rejection' }
    }

    const candidate = candidateSchema.parse({
      ...currentCandidate,
      currentStage,
      stageChangedAt,
      revision: currentCandidate.revision + 1,
    })
    const receipt = persistedStageReceiptSchema.parse({
      clientMutationId,
      candidateId,
      currentStage,
      expectedRevision,
      requestId,
      committedAt,
      candidate,
    })
    const nextEnvelope = persistedEnvelopeSchema.parse({
      ...envelope,
      mutations: {
        ...envelope.mutations,
        [candidateId]: {
          currentStage: candidate.currentStage,
          stageChangedAt: candidate.stageChangedAt,
          revision: candidate.revision,
        },
      },
      receipts: retainRecentReceipts(
        envelope.receipts,
        receipt,
        committedAt,
        receiptTtlMs,
      ),
    })

    // localStorage can throw (quota, policy, private mode). With no mutable
    // cache, a failed write leaves neither candidate nor receipt half-applied.
    storage.write(JSON.stringify(nextEnvelope))

    return { status: 'updated', candidate, receipt }
  }

  function commitStage(
    input: CommitCandidateStageInput,
  ): CandidateStageCommitResult {
    const result = commitStageFromEnvelope(input, readEnvelope())

    if (result.status === 'transient-rejection') {
      throw new Error('동기 commit은 transient rejection을 사용하지 않습니다.')
    }

    return result
  }

  return {
    list(size: CandidateListSize) {
      if (size === 0) {
        return []
      }

      const envelope = readEnvelope()

      return candidates
        .slice(0, size)
        .map((candidate) => applyMutation(candidate, envelope))
    },
    getById,
    lookupStageReceipt({
      checkedAt,
      ...operation
    }: LookupCandidateStageReceiptInput): CandidateStageReceiptLookupResult {
      return lookupReceipt(readEnvelope(), operation, checkedAt, receiptTtlMs)
    },
    commitStage,
    commitStageExclusive(
      input: CommitCandidateStageInput,
      rejectNewCommit = false,
    ) {
      return storage.runExclusive(() =>
        commitStageFromEnvelope(input, readEnvelope(), rejectNewCommit),
      )
    },
    reset() {
      storage.remove()
    },
  }
}
