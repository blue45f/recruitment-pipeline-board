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
  type CandidateMovementNotification,
  type CandidateMovementCoordinator,
} from './CandidateMovementCoordinator'
import { CandidateMovementContext } from './CandidateMovementContext'

const UNKNOWN_MOVE_MESSAGE = '단계 변경 결과를 확인하지 못했습니다.'
const MOVEMENT_TOAST_DURATION_MS = 8_000

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

  if (error.status === 409 && error.code === 'UNDO_NOT_AVAILABLE') {
    return new MoveExecutionError({
      cause: error,
      kind: 'undo-unavailable',
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

function notifyMoveResult(result: CandidateMovementNotification) {
  if (result.status === 'success') {
    toast.success(
      `${result.intent.candidateName} 후보자를 ${CANDIDATE_STAGE_LABELS[result.intent.targetStage]} 단계로 이동했습니다.`,
      { duration: MOVEMENT_TOAST_DURATION_MS },
    )
    return
  }

  if (result.status === 'undo-success') {
    toast.success(
      `${result.receipt.candidateName} 후보자를 ${CANDIDATE_STAGE_LABELS[result.receipt.fromStage]} 단계로 되돌렸습니다.`,
    )
    return
  }

  if (result.status === 'undo-failure') {
    if (result.retryable) return

    toast.error(
      `${result.receipt.candidateName} 후보자의 실행 취소를 완료하지 못했습니다. ${CANDIDATE_STAGE_LABELS[result.currentStage]} 단계가 유지됩니다. ${result.safeMessage}`,
      { duration: MOVEMENT_TOAST_DURATION_MS },
    )
    return
  }

  if (result.status === 'undo-verification-required') {
    // The persistent verification notice owns the live announcement and action.
    // Avoid announcing the same state again from a second live region.
    return
  }
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
          ...(command.compensatesClientMutationId === undefined
            ? {}
            : {
                compensatesClientMutationId:
                  command.compensatesClientMutationId,
              }),
          expectedRevision: command.expectedRevision,
          stage: command.targetStage,
        })

      const undoReceipt = response.meta.undoReceipt

      return {
        candidate: response.data,
        ...(undoReceipt === undefined
          ? {}
          : {
              undoReceipt: {
                candidateId: undoReceipt.candidateId,
                clientMutationId: undoReceipt.clientMutationId,
                committedRevision: undoReceipt.committedRevision,
                committedStage: undoReceipt.currentStage,
                previousStage: undoReceipt.previousStage,
              },
            }),
      }
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
