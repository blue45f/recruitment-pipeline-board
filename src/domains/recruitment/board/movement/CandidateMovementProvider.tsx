import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState, type PropsWithChildren } from 'react'
import { toast } from 'sonner'

import { ApiError, createCandidateApi } from '../../candidates/api'
import { CANDIDATE_STAGE_LABELS } from '../../candidates/model'
import {
  candidateStageMutationOptions,
  findLatestConfirmedCandidateInCache,
  mergeConfirmedCandidateInCache,
} from '../../candidates/query'
import {
  MoveExecutionError,
  createCandidateMovementCoordinator,
  type CandidateMoveCommand,
  type CandidateMoveResult,
  type CandidateMovementCoordinator,
} from './CandidateMovementCoordinator'
import { CandidateMovementContext } from './CandidateMovementContext'

const UNKNOWN_MOVE_MESSAGE = '단계 변경 결과를 확인하지 못했습니다.'

function normalizeMovementError(error: unknown) {
  if (error instanceof MoveExecutionError) {
    return error
  }

  if (!(error instanceof ApiError)) {
    return new MoveExecutionError({
      cause: error,
      kind: 'failed',
      safeMessage: UNKNOWN_MOVE_MESSAGE,
    })
  }

  if (error.status === 409 && error.code === 'REVISION_CONFLICT') {
    return new MoveExecutionError({
      cause: error,
      kind: 'revision-conflict',
      safeMessage: error.safeMessage,
    })
  }

  if (error.status === 409 && error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
    return new MoveExecutionError({
      cause: error,
      kind: 'idempotency-conflict',
      safeMessage: error.safeMessage,
    })
  }

  const hasUnknownOutcome =
    error.kind === 'network' ||
    error.kind === 'timeout' ||
    error.kind === 'schema' ||
    error.kind === 'unknown'

  return new MoveExecutionError({
    cause: error,
    kind: hasUnknownOutcome ? 'unknown-outcome' : 'failed',
    safeMessage: error.safeMessage,
  })
}

function notifyMoveResult(result: CandidateMoveResult) {
  if (result.status !== 'success') {
    return
  }

  toast.success(
    `${result.intent.candidateName} 후보자를 ${CANDIDATE_STAGE_LABELS[result.intent.targetStage]} 단계로 이동했습니다.`,
    { duration: 8_000 },
  )
}

function createQueryMovementCoordinator(queryClient: QueryClient) {
  const candidateApi = createCandidateApi()

  async function execute(command: CandidateMoveCommand) {
    try {
      const response = await queryClient
        .getMutationCache()
        .build(queryClient, candidateStageMutationOptions(candidateApi))
        .execute({
          candidateId: command.candidateId,
          clientMutationId: command.clientMutationId,
          expectedRevision: command.expectedRevision,
          stage: command.targetStage,
        })

      return response.data
    } catch (error) {
      throw normalizeMovementError(error)
    }
  }

  return createCandidateMovementCoordinator({
    execute,
    mergeConfirmed: (candidate) => {
      mergeConfirmedCandidateInCache(queryClient, candidate)
    },
    notify: notifyMoveResult,
    readConfirmedCandidate: (candidateId) =>
      findLatestConfirmedCandidateInCache(queryClient, candidateId),
    reconcile: async (candidateId) => {
      try {
        const response = await candidateApi.detail({ candidateId })

        if (response.data.id !== candidateId) {
          throw new MoveExecutionError({
            cause: response,
            kind: 'unknown-outcome',
            safeMessage: '후보자 최신 응답을 확인하지 못했습니다.',
          })
        }

        mergeConfirmedCandidateInCache(queryClient, response.data)
        return (
          findLatestConfirmedCandidateInCache(queryClient, candidateId) ??
          response.data
        )
      } catch (error) {
        throw normalizeMovementError(error)
      }
    },
  })
}

export type CandidateMovementProviderProps = Readonly<
  PropsWithChildren<{
    coordinator?: CandidateMovementCoordinator
  }>
>

export function CandidateMovementProvider({
  children,
  coordinator: providedCoordinator,
}: CandidateMovementProviderProps) {
  const queryClient = useQueryClient()
  const [coordinator] = useState(
    () => providedCoordinator ?? createQueryMovementCoordinator(queryClient),
  )

  return (
    <CandidateMovementContext.Provider value={coordinator}>
      {children}
    </CandidateMovementContext.Provider>
  )
}
