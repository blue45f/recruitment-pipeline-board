import type { KyInstance } from 'ky'

import {
  candidateDetailRequestSchema,
  candidateDetailResponseSchema,
  candidateListRequestSchema,
  candidateListResponseSchema,
  candidateStageUpdateRequestSchema,
  candidateStageUpdateResponseSchema,
  type CandidateDetailRequest,
  type CandidateListRequest,
  type CandidateStageUpdateRequest,
} from '../model'
import { ApiError } from './http/ApiError'
import { createCandidateHttpClient } from './http/createCandidateHttpClient'
import { requestJson } from './http/requestJson'

type RequestOptions = {
  signal?: AbortSignal
}

function requestContractError(cause: unknown) {
  return new ApiError({
    kind: 'schema',
    status: undefined,
    requestId: undefined,
    retryable: false,
    safeMessage: '요청 형식을 확인할 수 없습니다.',
    cause,
  })
}

function parseRequest<Input>(
  schema: {
    safeParse: (value: unknown) => {
      success: boolean
      data?: Input
      error?: unknown
    }
  },
  input: unknown,
) {
  const parsed = schema.safeParse(input)

  if (!parsed.success || parsed.data === undefined) {
    throw requestContractError(parsed.error)
  }

  return parsed.data
}

export function createCandidateApi(
  client: KyInstance = createCandidateHttpClient(),
) {
  return {
    async list(input: CandidateListRequest, options: RequestOptions = {}) {
      const request = parseRequest(candidateListRequestSchema, input)

      return requestJson(
        client.get('candidates', {
          searchParams: { size: request.size },
          ...options,
        }),
        candidateListResponseSchema,
        'query',
      )
    },
    async detail(input: CandidateDetailRequest, options: RequestOptions = {}) {
      const request = parseRequest(candidateDetailRequestSchema, input)
      const responseSchema = candidateDetailResponseSchema.refine(
        (response) => response.data.id === request.candidateId,
        {
          message: '응답 후보자 ID가 요청과 다릅니다.',
          path: ['data', 'id'],
        },
      )

      return requestJson(
        client.get(`candidates/${request.candidateId}`, options),
        responseSchema,
        'query',
      )
    },
    async updateStage(
      candidate: CandidateDetailRequest,
      input: CandidateStageUpdateRequest,
      options: RequestOptions = {},
    ) {
      const candidateRequest = parseRequest(
        candidateDetailRequestSchema,
        candidate,
      )
      const updateRequest = parseRequest(
        candidateStageUpdateRequestSchema,
        input,
      )

      return requestJson(
        client.patch(`candidates/${candidateRequest.candidateId}/stage`, {
          json: updateRequest,
          ...options,
        }),
        candidateStageUpdateResponseSchema,
        'mutation',
      )
    },
  }
}

export type CandidateApi = ReturnType<typeof createCandidateApi>
