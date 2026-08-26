import { isHTTPError, isNetworkError, isTimeoutError } from 'ky'

import { ApiError } from './ApiError'

export type ApiOperation = 'query' | 'mutation'

const SAFE_MESSAGES = {
  conflict: '다른 변경이 먼저 반영되었습니다. 최신 상태를 확인해 주세요.',
  default: '요청을 처리하지 못했습니다.',
  network: '네트워크 연결을 확인해 주세요.',
  notFound: '지원자를 찾을 수 없습니다.',
  server: '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
  timeout: '응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
} as const

export function requestIdFromHeaders(headers: Headers) {
  const value = headers.get('x-request-id')?.trim()

  if (value === undefined || value.length === 0 || value.length > 100) {
    return undefined
  }

  return value
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function safeHttpMessage(status: number) {
  if (status === 409) return SAFE_MESSAGES.conflict
  if (status === 404) return SAFE_MESSAGES.notFound
  if (status >= 500) return SAFE_MESSAGES.server
  return SAFE_MESSAGES.default
}

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 429 || status >= 500
}

export function normalizeTransportError(
  error: unknown,
  operation: ApiOperation,
): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (isHTTPError<unknown>(error)) {
    const status = error.response.status

    return new ApiError({
      kind: 'http',
      status,
      requestId: requestIdFromHeaders(error.response.headers),
      retryable: operation === 'query' && isRetryableHttpStatus(status),
      safeMessage: safeHttpMessage(status),
      // Ky 2 already consumed the body into error.data. Keep the HTTPError as
      // diagnostic cause without reading or exposing its untrusted message.
      cause: error,
    })
  }

  if (isTimeoutError(error)) {
    return new ApiError({
      kind: 'timeout',
      status: undefined,
      requestId: undefined,
      retryable: operation === 'query',
      safeMessage: SAFE_MESSAGES.timeout,
      cause: error,
    })
  }

  if (isNetworkError(error) || error instanceof TypeError) {
    return new ApiError({
      kind: 'network',
      status: undefined,
      requestId: undefined,
      retryable: operation === 'query',
      safeMessage: SAFE_MESSAGES.network,
      cause: error,
    })
  }

  return new ApiError({
    kind: 'unknown',
    status: undefined,
    requestId: undefined,
    retryable: false,
    safeMessage: SAFE_MESSAGES.default,
    cause: error,
  })
}
