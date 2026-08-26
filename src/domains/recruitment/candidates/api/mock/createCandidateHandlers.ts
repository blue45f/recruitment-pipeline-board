import { delay, http, HttpResponse, type RequestHandler } from 'msw'

import {
  candidateDetailRequestSchema,
  candidateDetailResponseSchema,
  candidateListRequestSchema,
  candidateListResponseSchema,
  candidateStageUpdateRequestSchema,
  candidateStageUpdateResponseSchema,
  type CandidateListSize,
} from '../../model'
import type { CandidateMockRepository } from './candidateMockRepository'

const LIST_SIZE_BY_QUERY = {
  '0': 0,
  '200': 200,
  '1000': 1_000,
} as const satisfies Record<string, CandidateListSize>

const DEFAULT_SAFE_MESSAGE =
  '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export const CANDIDATE_MOCK_LATENCY = {
  min: 200,
  max: 800,
} as const

export const CANDIDATE_MOCK_FAILURE_RATE = 0.15

type CreateCandidateHandlersOptions = {
  repository: CandidateMockRepository
  wait?: (milliseconds: number) => Promise<void>
  latency?: () => number
  shouldFail?: () => boolean
  now?: () => Date
  createRequestId?: () => string
}

type ErrorResponseOptions = {
  status: number
  code: string
  requestId: string
  retryable: boolean
  safeMessage?: string
}

let fallbackRequestSequence = 0

export function latencyFromRandom(value: number) {
  const normalized = Math.min(Math.max(value, 0), 1)

  return Math.min(
    CANDIDATE_MOCK_LATENCY.max,
    CANDIDATE_MOCK_LATENCY.min +
      Math.floor(
        normalized *
          (CANDIDATE_MOCK_LATENCY.max - CANDIDATE_MOCK_LATENCY.min + 1),
      ),
  )
}

export function shouldSimulateFailure(value: number) {
  return value < CANDIDATE_MOCK_FAILURE_RATE
}

function defaultRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  fallbackRequestSequence += 1
  return `mock-request-${fallbackRequestSequence}`
}

function errorResponse({
  status,
  code,
  requestId,
  retryable,
  safeMessage = DEFAULT_SAFE_MESSAGE,
}: ErrorResponseOptions) {
  return HttpResponse.json(
    {
      error: {
        code,
        message: safeMessage,
        requestId,
        retryable,
      },
    },
    {
      status,
      headers: { 'x-request-id': requestId },
    },
  )
}

function candidateIdFromParams(
  params: Record<string, string | readonly string[] | undefined>,
) {
  return candidateDetailRequestSchema.safeParse({
    candidateId: params.candidateId,
  })
}

function listRequestFromUrl(url: URL) {
  const values = url.searchParams.getAll('size')

  if (values.length !== 1) {
    return candidateListRequestSchema.safeParse({ size: undefined })
  }

  return candidateListRequestSchema.safeParse({
    size: LIST_SIZE_BY_QUERY[values[0] as keyof typeof LIST_SIZE_BY_QUERY],
  })
}

export function createCandidateHandlers({
  repository,
  wait = delay,
  latency = () => latencyFromRandom(Math.random()),
  shouldFail = () => shouldSimulateFailure(Math.random()),
  now = () => new Date(),
  createRequestId = defaultRequestId,
}: CreateCandidateHandlersOptions): RequestHandler[] {
  async function simulateNetwork(requestId: string) {
    await wait(latency())

    if (!shouldFail()) {
      return undefined
    }

    return errorResponse({
      status: 503,
      code: 'SIMULATED_FAILURE',
      requestId,
      retryable: true,
    })
  }

  return [
    http.get('*/api/candidates', async ({ request }) => {
      const requestId = createRequestId()
      const parsedRequest = listRequestFromUrl(new URL(request.url))

      if (!parsedRequest.success) {
        return errorResponse({
          status: 400,
          code: 'INVALID_REQUEST',
          requestId,
          retryable: false,
          safeMessage: '목록 요청 조건이 올바르지 않습니다.',
        })
      }

      const failureResponse = await simulateNetwork(requestId)
      if (failureResponse !== undefined) return failureResponse

      try {
        const data = repository.list(parsedRequest.data.size)
        const response = candidateListResponseSchema.parse({
          data,
          meta: { total: data.length },
        })

        return HttpResponse.json(response, {
          headers: { 'x-request-id': requestId },
        })
      } catch {
        return errorResponse({
          status: 503,
          code: 'PERSISTENCE_FAILURE',
          requestId,
          retryable: true,
        })
      }
    }),
    http.get('*/api/candidates/:candidateId', async ({ params }) => {
      const requestId = createRequestId()
      const parsedRequest = candidateIdFromParams(params)

      if (!parsedRequest.success) {
        return errorResponse({
          status: 400,
          code: 'INVALID_REQUEST',
          requestId,
          retryable: false,
        })
      }

      const failureResponse = await simulateNetwork(requestId)
      if (failureResponse !== undefined) return failureResponse

      let candidate

      try {
        candidate = repository.getById(parsedRequest.data.candidateId)
      } catch {
        return errorResponse({
          status: 503,
          code: 'PERSISTENCE_FAILURE',
          requestId,
          retryable: true,
        })
      }

      if (candidate === undefined) {
        return errorResponse({
          status: 404,
          code: 'CANDIDATE_NOT_FOUND',
          requestId,
          retryable: false,
          safeMessage: '지원자를 찾을 수 없습니다.',
        })
      }

      return HttpResponse.json(
        candidateDetailResponseSchema.parse({ data: candidate }),
        { headers: { 'x-request-id': requestId } },
      )
    }),
    http.patch(
      '*/api/candidates/:candidateId/stage',
      async ({ params, request }) => {
        const requestId = createRequestId()
        const parsedCandidateId = candidateIdFromParams(params)
        let rawBody: unknown

        try {
          rawBody = await request.json()
        } catch {
          rawBody = undefined
        }

        const parsedBody = candidateStageUpdateRequestSchema.safeParse(rawBody)

        if (!parsedCandidateId.success || !parsedBody.success) {
          return errorResponse({
            status: 400,
            code: 'INVALID_REQUEST',
            requestId,
            retryable: false,
            safeMessage: '단계 변경 요청이 올바르지 않습니다.',
          })
        }

        const failureResponse = await simulateNetwork(requestId)
        if (failureResponse !== undefined) return failureResponse

        try {
          const result = repository.commitStage({
            candidateId: parsedCandidateId.data.candidateId,
            currentStage: parsedBody.data.stage,
            expectedRevision: parsedBody.data.expectedRevision,
            stageChangedAt: now().toISOString(),
          })

          if (result.status === 'not-found') {
            return errorResponse({
              status: 404,
              code: 'CANDIDATE_NOT_FOUND',
              requestId,
              retryable: false,
              safeMessage: '지원자를 찾을 수 없습니다.',
            })
          }

          if (result.status === 'conflict') {
            return errorResponse({
              status: 409,
              code: 'REVISION_CONFLICT',
              requestId,
              retryable: false,
              safeMessage: '다른 변경이 먼저 반영되었습니다.',
            })
          }

          const response = candidateStageUpdateResponseSchema.parse({
            data: result.candidate,
            meta: {
              requestId,
              clientMutationId: parsedBody.data.clientMutationId,
            },
          })

          return HttpResponse.json(response, {
            headers: { 'x-request-id': requestId },
          })
        } catch {
          return errorResponse({
            status: 503,
            code: 'PERSISTENCE_FAILURE',
            requestId,
            retryable: true,
          })
        }
      },
    ),
  ]
}
