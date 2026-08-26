// @vitest-environment node

import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import {
  candidateDetailResponseSchema,
  candidateListResponseSchema,
  candidateStageUpdateResponseSchema,
  generateCandidateFixtures,
} from '../model'
import { createCandidateApi } from './candidateApi'
import { ApiError } from './http/ApiError'
import { createCandidateHttpClient } from './http/createCandidateHttpClient'
import { server } from '@/mocks/server'

const API_ORIGIN = 'http://client.test'
const candidate = generateCandidateFixtures({ seed: 42, size: 200 })[0]

if (candidate === undefined) {
  throw new Error('후보자 fixture를 만들지 못했습니다.')
}

function createTestApi(
  options: { timeout?: number; fetch?: typeof fetch } = {},
) {
  return createCandidateApi(
    createCandidateHttpClient({
      prefixUrl: `${API_ORIGIN}/api/`,
      timeout: options.timeout ?? 1_000,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }),
  )
}

async function expectApiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    return error as ApiError
  }

  throw new Error('ApiError가 발생하지 않았습니다.')
}

describe('candidate API client', () => {
  it('목록 응답을 unknown부터 Zod로 검증한다', async () => {
    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json(
          candidateListResponseSchema.parse({
            data: [candidate],
            meta: { total: 1 },
          }),
        ),
      ),
    )

    await expect(createTestApi().list({ size: 200 })).resolves.toEqual({
      data: [candidate],
      meta: { total: 1 },
    })
  })

  it('상세와 단계 변경 응답 계약을 각각 검증한다', async () => {
    const updatedCandidate = {
      ...candidate,
      currentStage: 'hired' as const,
      stageChangedAt: '2026-08-26T07:00:00.000Z',
      revision: candidate.revision + 1,
    }

    server.use(
      http.get('*/api/candidates/:candidateId', () =>
        HttpResponse.json(
          candidateDetailResponseSchema.parse({ data: candidate }),
        ),
      ),
      http.patch('*/api/candidates/:candidateId/stage', () =>
        HttpResponse.json(
          candidateStageUpdateResponseSchema.parse({
            data: updatedCandidate,
            meta: {
              requestId: 'request-update',
              clientMutationId: 'mutation-update',
            },
          }),
        ),
      ),
    )
    const api = createTestApi()

    await expect(api.detail({ candidateId: candidate.id })).resolves.toEqual({
      data: candidate,
    })
    await expect(
      api.updateStage(
        { candidateId: candidate.id },
        {
          stage: 'hired',
          expectedRevision: candidate.revision,
          clientMutationId: 'mutation-update',
        },
      ),
    ).resolves.toEqual({
      data: updatedCandidate,
      meta: {
        requestId: 'request-update',
        clientMutationId: 'mutation-update',
      },
    })
  })

  it('보상 reference를 PATCH body에 전달하고 Undo receipt 없는 응답을 보존한다', async () => {
    const movedCandidate = {
      ...candidate,
      currentStage: 'hired' as const,
      stageChangedAt: '2026-08-26T07:00:00.000Z',
      revision: candidate.revision + 1,
    }
    const compensatedCandidate = {
      ...movedCandidate,
      currentStage: candidate.currentStage,
      stageChangedAt: '2026-08-26T07:01:00.000Z',
      revision: candidate.revision + 2,
    }
    let requestBody: unknown

    server.use(
      http.patch('*/api/candidates/:candidateId/stage', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({
          data: compensatedCandidate,
          meta: {
            requestId: 'request-compensation',
            clientMutationId: 'mutation-compensation',
          },
        })
      }),
    )

    await expect(
      createTestApi().updateStage(
        { candidateId: candidate.id },
        {
          stage: candidate.currentStage,
          expectedRevision: movedCandidate.revision,
          clientMutationId: 'mutation-compensation',
          compensatesClientMutationId: 'mutation-original',
        },
      ),
    ).resolves.toEqual({
      data: compensatedCandidate,
      meta: {
        requestId: 'request-compensation',
        clientMutationId: 'mutation-compensation',
      },
    })
    expect(requestBody).toEqual({
      stage: candidate.currentStage,
      expectedRevision: movedCandidate.revision,
      clientMutationId: 'mutation-compensation',
      compensatesClientMutationId: 'mutation-original',
    })
  })

  it('응답 data와 상관관계가 다른 Undo receipt를 캐시 전에 거부한다', async () => {
    const updatedCandidate = {
      ...candidate,
      currentStage: 'hired' as const,
      stageChangedAt: '2026-08-26T07:00:00.000Z',
      revision: candidate.revision + 1,
    }
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () =>
        HttpResponse.json({
          data: updatedCandidate,
          meta: {
            requestId: 'request-broken-undo-receipt',
            clientMutationId: 'mutation-broken-undo-receipt',
            undoReceipt: {
              candidateId: 'candidate-another',
              clientMutationId: 'mutation-broken-undo-receipt',
              previousStage: candidate.currentStage,
              currentStage: updatedCandidate.currentStage,
              expectedRevision: candidate.revision,
              committedRevision: updatedCandidate.revision,
            },
          },
        }),
      ),
    )

    const error = await expectApiError(
      createTestApi().updateStage(
        { candidateId: candidate.id },
        {
          stage: updatedCandidate.currentStage,
          expectedRevision: candidate.revision,
          clientMutationId: 'mutation-broken-undo-receipt',
        },
      ),
    )

    expect(error).toMatchObject({ kind: 'schema', retryable: false })
    expect(error.cause).toBeInstanceOf(ZodError)
  })

  it('상세 응답의 후보자 ID가 요청과 다르면 캐시하기 전에 거부한다', async () => {
    const anotherCandidate = generateCandidateFixtures({
      seed: 43,
      size: 200,
    })[0]

    expect(anotherCandidate).toBeDefined()
    if (anotherCandidate === undefined) return

    server.use(
      http.get('*/api/candidates/:candidateId', () =>
        HttpResponse.json(
          candidateDetailResponseSchema.parse({ data: anotherCandidate }),
          { headers: { 'x-request-id': 'mismatched-detail' } },
        ),
      ),
    )

    const error = await expectApiError(
      createTestApi().detail({ candidateId: candidate.id }),
    )

    expect(error).toMatchObject({
      kind: 'schema',
      requestId: 'mismatched-detail',
      retryable: false,
      safeMessage: '응답 형식을 확인할 수 없습니다.',
      status: 200,
    })
    expect(error.cause).toBeInstanceOf(ZodError)
  })

  it('strict 응답 스키마 불일치를 안전한 schema 오류로 바꾼다', async () => {
    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json(
          {
            data: [candidate],
            meta: { total: 1 },
            unexpected: 'server-only detail',
          },
          { headers: { 'x-request-id': 'schema-request' } },
        ),
      ),
    )

    const error = await expectApiError(createTestApi().list({ size: 200 }))

    expect(error).toMatchObject({
      kind: 'schema',
      status: 200,
      requestId: 'schema-request',
      retryable: false,
      safeMessage: '응답 형식을 확인할 수 없습니다.',
    })
    expect(error.cause).toBeInstanceOf(ZodError)
  })

  it('깨진 JSON도 재시도하지 않는 schema 오류로 바꾼다', async () => {
    server.use(
      http.get(
        '*/api/candidates',
        () =>
          new HttpResponse('{"data":', {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'x-request-id': 'malformed-request',
            },
          }),
      ),
    )

    const error = await expectApiError(createTestApi().list({ size: 200 }))

    expect(error).toMatchObject({
      kind: 'schema',
      requestId: 'malformed-request',
      retryable: false,
    })
    expect(error.cause).toBeInstanceOf(SyntaxError)
  })

  it.each([
    [
      'REVISION_CONFLICT',
      'mutation-revision-conflict',
      '다른 변경이 먼저 반영되었습니다. 최신 상태를 확인해 주세요.',
    ],
    [
      'IDEMPOTENCY_KEY_CONFLICT',
      'mutation-idempotency-conflict',
      '같은 요청 식별자가 다른 단계 변경에 사용되었습니다. 다시 시도해 주세요.',
    ],
    [
      'UNDO_NOT_AVAILABLE',
      'mutation-undo-not-available',
      '이 단계 변경은 더 이상 되돌릴 수 없습니다. 최신 상태를 확인해 주세요.',
    ],
  ] as const)(
    '409 %s 코드를 보존하되 HTTPError.data의 서버 원문은 노출하지 않는다',
    async (code, clientMutationId, safeMessage) => {
      const privateServerMessage = 'database shard secret detail'
      server.use(
        http.patch('*/api/candidates/:candidateId/stage', () =>
          HttpResponse.json(
            {
              error: {
                code,
                message: privateServerMessage,
                requestId: 'conflict-request',
                retryable: false,
              },
            },
            {
              status: 409,
              headers: { 'x-request-id': 'conflict-request' },
            },
          ),
        ),
      )

      const error = await expectApiError(
        createTestApi().updateStage(
          { candidateId: candidate.id },
          {
            stage: 'rejected',
            expectedRevision: candidate.revision,
            clientMutationId,
          },
        ),
      )

      expect(error).toMatchObject({
        kind: 'http',
        code,
        status: 409,
        requestId: 'conflict-request',
        retryable: false,
      })
      expect(error.message).not.toContain(privateServerMessage)
      expect(error.safeMessage).not.toContain(privateServerMessage)
      expect(error.safeMessage).toBe(safeMessage)
    },
  )

  it('whitelist 밖의 서버 오류 코드는 보존하지 않는다', async () => {
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () =>
        HttpResponse.json(
          {
            error: {
              code: 'DATABASE_INTERNAL_DETAIL',
              message: 'private server detail',
            },
          },
          { status: 409 },
        ),
      ),
    )

    const error = await expectApiError(
      createTestApi().updateStage(
        { candidateId: candidate.id },
        {
          stage: 'rejected',
          expectedRevision: candidate.revision,
          clientMutationId: 'mutation-unknown-code',
        },
      ),
    )

    expect(error.code).toBeUndefined()
    expect(error.message).not.toContain('private server detail')
  })

  it('Ky 자체는 503 GET을 재시도하지 않고 retryable 정보만 남긴다', async () => {
    let requestCount = 0
    server.use(
      http.get('*/api/candidates', () => {
        requestCount += 1
        return HttpResponse.json({}, { status: 503 })
      }),
    )

    const error = await expectApiError(createTestApi().list({ size: 200 }))

    expect(requestCount).toBe(1)
    expect(error).toMatchObject({
      kind: 'http',
      status: 503,
      retryable: true,
    })
  })

  it('503 mutation은 결과가 불명확하므로 재시도 가능으로 표시하지 않는다', async () => {
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    )

    const error = await expectApiError(
      createTestApi().updateStage(
        { candidateId: candidate.id },
        {
          stage: 'rejected',
          expectedRevision: candidate.revision,
          clientMutationId: 'mutation-no-retry',
        },
      ),
    )

    expect(error).toMatchObject({
      kind: 'http',
      status: 503,
      retryable: false,
    })
  })

  it('transport 구간의 네트워크 TypeError만 network 오류로 바꾼다', async () => {
    let requestCount = 0
    const fetchMock: typeof fetch = () => {
      requestCount += 1
      return Promise.reject(new TypeError('network unavailable'))
    }

    const error = await expectApiError(
      createTestApi({ fetch: fetchMock }).list({ size: 200 }),
    )

    expect(requestCount).toBe(1)
    expect(error).toMatchObject({ kind: 'network', retryable: true })
    expect(error.message).not.toContain('network unavailable')
  })

  it('timeout을 query 재시도 가능 오류로 구분한다', async () => {
    server.use(
      http.get('*/api/candidates', async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )

    const error = await expectApiError(
      createTestApi({ timeout: 10 }).list({ size: 200 }),
    )

    expect(error).toMatchObject({ kind: 'timeout', retryable: true })
  })

  it('mutation timeout은 처리 결과가 불명확해 재시도하지 않는다', async () => {
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )

    const error = await expectApiError(
      createTestApi({ timeout: 10 }).updateStage(
        { candidateId: candidate.id },
        {
          stage: 'rejected',
          expectedRevision: candidate.revision,
          clientMutationId: 'mutation-timeout',
        },
      ),
    )

    expect(error).toMatchObject({ kind: 'timeout', retryable: false })
  })

  it('AbortSignal 취소를 ApiError로 감싸지 않는다', async () => {
    server.use(
      http.get('*/api/candidates', async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    const controller = new AbortController()
    const request = createTestApi().list(
      { size: 200 },
      { signal: controller.signal },
    )

    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    await expect(request).rejects.not.toBeInstanceOf(ApiError)
  })

  it('잘못된 로컬 요청은 네트워크를 호출하기 전에 거부한다', async () => {
    let requestCount = 0
    server.use(
      http.get('*/api/candidates', () => {
        requestCount += 1
        return HttpResponse.json({})
      }),
    )

    const error = await expectApiError(
      createTestApi().list({ size: 100 as never }),
    )

    expect(requestCount).toBe(0)
    expect(error).toMatchObject({ kind: 'schema', retryable: false })
  })

  it('과도하거나 빈 request ID를 보존하지 않는다', async () => {
    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json(
          { data: [] },
          { headers: { 'x-request-id': 'x'.repeat(101) } },
        ),
      ),
    )

    const error = await expectApiError(createTestApi().list({ size: 200 }))

    expect(error.requestId).toBeUndefined()
  })
})
