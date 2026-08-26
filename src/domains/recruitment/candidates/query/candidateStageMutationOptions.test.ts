import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { ApiError, type CandidateApi } from '../api'
import type { Candidate, CandidateStageUpdateResponse } from '../model'
import {
  candidateStageMutationOptions,
  type CandidateStageMutationVariables,
} from './candidateStageMutationOptions'

const candidate: Candidate = {
  id: 'candidate-stage-mutation',
  name: '김이동',
  role: 'frontend_engineer',
  appliedAt: '2026-08-20T00:00:00.000Z',
  currentStage: 'document_review',
  email: 'move@example.com',
  experienceYears: 5,
  memo: '단계 변경 query 테스트',
  stageChangedAt: '2026-08-20T00:00:00.000Z',
  revision: 2,
}

const variables: CandidateStageMutationVariables = {
  candidateId: candidate.id,
  clientMutationId: 'stage-mutation-1',
  expectedRevision: candidate.revision,
  stage: 'interview',
}

function createApi(response: CandidateStageUpdateResponse) {
  return {
    detail: vi.fn(),
    list: vi.fn(),
    updateStage: vi.fn().mockResolvedValue(response),
  } satisfies CandidateApi
}

function successfulResponse(): CandidateStageUpdateResponse {
  return {
    data: {
      ...candidate,
      currentStage: variables.stage,
      revision: candidate.revision + 1,
      stageChangedAt: '2026-08-26T08:00:00.000Z',
    },
    meta: {
      clientMutationId: variables.clientMutationId,
      requestId: 'request-stage-mutation',
      undoReceipt: {
        candidateId: candidate.id,
        clientMutationId: variables.clientMutationId,
        previousStage: candidate.currentStage,
        currentStage: variables.stage,
        expectedRevision: variables.expectedRevision,
        committedRevision: variables.expectedRevision + 1,
      },
    },
  }
}

const mismatchedResponses = [
  [
    '후보자',
    (response: CandidateStageUpdateResponse) => ({
      ...response,
      data: { ...response.data, id: 'another-candidate' },
    }),
  ],
  [
    '단계',
    (response: CandidateStageUpdateResponse) => ({
      ...response,
      data: { ...response.data, currentStage: 'hired' as const },
    }),
  ],
  [
    'revision 증가량',
    (response: CandidateStageUpdateResponse) => ({
      ...response,
      data: { ...response.data, revision: candidate.revision + 2 },
    }),
  ],
  [
    'mutation ID',
    (response: CandidateStageUpdateResponse) => ({
      ...response,
      meta: { ...response.meta, clientMutationId: 'another-mutation' },
    }),
  ],
  [
    'Undo receipt',
    (response: CandidateStageUpdateResponse) => ({
      ...response,
      meta: {
        ...response.meta,
        undoReceipt: {
          ...response.meta.undoReceipt!,
          expectedRevision: variables.expectedRevision + 1,
        },
      },
    }),
  ],
  [
    'Undo receipt 누락',
    (response: CandidateStageUpdateResponse) => ({
      ...response,
      meta: {
        clientMutationId: response.meta.clientMutationId,
        requestId: response.meta.requestId,
      },
    }),
  ],
] as const satisfies readonly (readonly [
  string,
  (response: CandidateStageUpdateResponse) => CandidateStageUpdateResponse,
])[]

describe('candidate stage mutation options', () => {
  it('단계 변경 계약을 API에 전달하고 상관관계가 맞는 응답을 반환한다', async () => {
    const api = createApi(successfulResponse())
    const queryClient = new QueryClient()

    await expect(
      queryClient
        .getMutationCache()
        .build(queryClient, candidateStageMutationOptions(api))
        .execute(variables),
    ).resolves.toEqual(successfulResponse())

    expect(api.updateStage).toHaveBeenCalledExactlyOnceWith(
      { candidateId: candidate.id },
      {
        stage: variables.stage,
        expectedRevision: variables.expectedRevision,
        clientMutationId: variables.clientMutationId,
      },
    )
    expect(candidateStageMutationOptions(api).retry).toBe(false)
  })

  it.each(mismatchedResponses)(
    '%s 상관관계가 다른 응답을 안전한 schema 오류로 거부한다',
    async (_, createMismatchedResponse) => {
      const mismatchedResponse = createMismatchedResponse(successfulResponse())
      const queryClient = new QueryClient()

      const error = await queryClient
        .getMutationCache()
        .build(
          queryClient,
          candidateStageMutationOptions(createApi(mismatchedResponse)),
        )
        .execute(variables)
        .catch((cause: unknown) => cause)

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'schema',
        retryable: false,
        safeMessage: '단계 변경 응답을 확인할 수 없습니다.',
      })
    },
  )

  it('보상 reference를 API에 전달하고 Undo-of-Undo 없는 응답을 반환한다', async () => {
    const compensationVariables: CandidateStageMutationVariables = {
      candidateId: candidate.id,
      clientMutationId: 'stage-compensation-1',
      compensatesClientMutationId: variables.clientMutationId,
      expectedRevision: candidate.revision + 1,
      stage: candidate.currentStage,
    }
    const response: CandidateStageUpdateResponse = {
      data: {
        ...candidate,
        currentStage: compensationVariables.stage,
        revision: compensationVariables.expectedRevision + 1,
        stageChangedAt: '2026-08-26T08:01:00.000Z',
      },
      meta: {
        clientMutationId: compensationVariables.clientMutationId,
        requestId: 'request-stage-compensation',
      },
    }
    const api = createApi(response)
    const queryClient = new QueryClient()

    await expect(
      queryClient
        .getMutationCache()
        .build(queryClient, candidateStageMutationOptions(api))
        .execute(compensationVariables),
    ).resolves.toEqual(response)
    expect(api.updateStage).toHaveBeenCalledExactlyOnceWith(
      { candidateId: candidate.id },
      {
        stage: compensationVariables.stage,
        expectedRevision: compensationVariables.expectedRevision,
        clientMutationId: compensationVariables.clientMutationId,
        compensatesClientMutationId:
          compensationVariables.compensatesClientMutationId,
      },
    )
  })

  it('보상 응답에 Undo receipt가 포함되면 schema 오류로 거부한다', async () => {
    const compensationVariables: CandidateStageMutationVariables = {
      ...variables,
      clientMutationId: 'stage-compensation-with-receipt',
      compensatesClientMutationId: 'stage-original',
    }
    const response = successfulResponse()
    const invalidResponse: CandidateStageUpdateResponse = {
      ...response,
      meta: {
        ...response.meta,
        clientMutationId: compensationVariables.clientMutationId,
        undoReceipt: {
          ...response.meta.undoReceipt!,
          clientMutationId: compensationVariables.clientMutationId,
        },
      },
    }
    const queryClient = new QueryClient()

    const error = await queryClient
      .getMutationCache()
      .build(
        queryClient,
        candidateStageMutationOptions(createApi(invalidResponse)),
      )
      .execute(compensationVariables)
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'schema', retryable: false })
  })
})
