import { z } from 'zod'

import {
  candidateIdSchema,
  candidateSchema,
  candidateStageSchema,
  generateCandidateFixtures,
  type Candidate,
  type CandidateId,
  type CandidateListSize,
  type CandidateStage,
} from '../../model'
import type { CandidateMockStorage } from './candidateMockStorage'

const STORAGE_VERSION = 1 as const
const DEFAULT_FIXTURE_SEED = 20_260_826

const persistedMutationSchema = z
  .object({
    currentStage: candidateStageSchema,
    stageChangedAt: z.iso.datetime({ offset: true }),
    revision: z.number().int().nonnegative(),
  })
  .strict()

const persistedEnvelopeSchema = z
  .object({
    version: z.literal(STORAGE_VERSION),
    seed: z.number().int().min(0).max(0xffff_ffff),
    mutations: z.record(candidateIdSchema, persistedMutationSchema),
  })
  .strict()

type PersistedEnvelope = z.infer<typeof persistedEnvelopeSchema>

export type CandidateMockRepository = ReturnType<
  typeof createCandidateMockRepository
>

export type CandidateStageCommitResult =
  | { status: 'updated'; candidate: Candidate }
  | { status: 'not-found' }
  | { status: 'conflict'; candidate: Candidate }

type CreateCandidateMockRepositoryOptions = {
  storage: CandidateMockStorage
  seed?: number
}

type CommitCandidateStageInput = {
  candidateId: CandidateId
  currentStage: CandidateStage
  expectedRevision: number
  stageChangedAt: string
}

function emptyEnvelope(seed: number): PersistedEnvelope {
  return { version: STORAGE_VERSION, seed, mutations: {} }
}

function parseEnvelope(value: string | null, seed: number) {
  if (value === null) {
    return emptyEnvelope(seed)
  }

  try {
    const parsed = persistedEnvelopeSchema.safeParse(JSON.parse(value))

    if (!parsed.success || parsed.data.seed !== seed) {
      return emptyEnvelope(seed)
    }

    return parsed.data
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

export function createCandidateMockRepository({
  storage,
  seed = DEFAULT_FIXTURE_SEED,
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
    commitStage({
      candidateId,
      currentStage,
      expectedRevision,
      stageChangedAt,
    }: CommitCandidateStageInput): CandidateStageCommitResult {
      // The fresh read, revision comparison and persistence deliberately have
      // no await between them. One JavaScript runtime therefore commits a CAS
      // before another delayed request can observe the same revision.
      const envelope = readEnvelope()
      const baseCandidate = candidatesById.get(candidateId)

      if (baseCandidate === undefined) {
        return { status: 'not-found' }
      }

      const currentCandidate = applyMutation(baseCandidate, envelope)

      if (currentCandidate.revision !== expectedRevision) {
        return { status: 'conflict', candidate: currentCandidate }
      }

      const candidate = candidateSchema.parse({
        ...currentCandidate,
        currentStage,
        stageChangedAt,
        revision: currentCandidate.revision + 1,
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
      })

      // localStorage can throw (quota, policy, private mode). Since the
      // repository has no mutable cache, a failed write leaves no partial
      // in-memory commit behind.
      storage.write(JSON.stringify(nextEnvelope))

      return { status: 'updated', candidate }
    },
    reset() {
      storage.remove()
    },
  }
}
