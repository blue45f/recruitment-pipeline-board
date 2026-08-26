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

  it('HTTPError.data의 서버 원문을 사용자 메시지로 노출하지 않는다', async () => {
    const privateServerMessage = 'database shard secret detail'
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () =>
        HttpResponse.json(
          { error: { message: privateServerMessage } },
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
          clientMutationId: 'mutation-conflict',
        },
      ),
    )

    expect(error).toMatchObject({
      kind: 'http',
      status: 409,
      requestId: 'conflict-request',
      retryable: false,
    })
    expect(error.message).not.toContain(privateServerMessage)
    expect(error.safeMessage).not.toContain(privateServerMessage)
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
