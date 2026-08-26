import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api'
import { queryClient } from '@/lib/query/queryClient'

function configuredRetry() {
  const retry = queryClient.getDefaultOptions().queries?.retry

  if (typeof retry !== 'function') {
    throw new TypeError('QueryClient의 retry 정책이 함수가 아닙니다.')
  }

  return retry
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: configuredRetry(),
        retryDelay: 0,
      },
    },
  })
}

function apiError(options: Pick<ApiError, 'kind' | 'retryable' | 'status'>) {
  return new ApiError({
    ...options,
    requestId: undefined,
    safeMessage: '안전한 테스트 오류',
    cause: undefined,
  })
}

describe('global query retry policy', () => {
  const clients: QueryClient[] = []

  afterEach(() => {
    clients.forEach((client) => client.clear())
    clients.length = 0
  })

  it('retryable ApiError만 한 번 재시도한다', async () => {
    const client = createTestQueryClient()
    clients.push(client)
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        apiError({ kind: 'http', retryable: true, status: 503 }),
      )
      .mockResolvedValue('recovered')

    await expect(
      client.fetchQuery({ queryKey: ['retryable'], queryFn }),
    ).resolves.toBe('recovered')
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it.each([
    {
      name: 'AbortError',
      error: new DOMException('aborted', 'AbortError'),
    },
    {
      name: '일반 Error',
      error: Object.assign(new Error('not api error'), { retryable: true }),
    },
    {
      name: 'schema ApiError',
      error: apiError({ kind: 'schema', retryable: true, status: 200 }),
    },
    {
      name: '404 ApiError',
      error: apiError({ kind: 'http', retryable: true, status: 404 }),
    },
  ])('$name는 재시도하지 않는다', async ({ error }) => {
    const client = createTestQueryClient()
    clients.push(client)
    const queryFn = vi.fn<() => Promise<never>>().mockRejectedValue(error)

    await expect(
      client.fetchQuery({ queryKey: ['no-retry', error.name], queryFn }),
    ).rejects.toBe(error)
    expect(queryFn).toHaveBeenCalledOnce()
  })

  it('retryable 오류가 연속되어도 재시도는 한 번으로 제한한다', async () => {
    const client = createTestQueryClient()
    clients.push(client)
    const error = apiError({
      kind: 'network',
      retryable: true,
      status: undefined,
    })
    const queryFn = vi.fn<() => Promise<never>>().mockRejectedValue(error)

    await expect(
      client.fetchQuery({ queryKey: ['retry-limit'], queryFn }),
    ).rejects.toBe(error)
    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})
