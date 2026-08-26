import type { ResponsePromise } from 'ky'
import type { ZodType } from 'zod'

import { ApiError } from './ApiError'
import {
  isAbortError,
  normalizeTransportError,
  requestIdFromHeaders,
  type ApiOperation,
} from './normalizeApiError'

const SCHEMA_SAFE_MESSAGE = '응답 형식을 확인할 수 없습니다.'

export async function requestJson<Output>(
  request: ResponsePromise,
  schema: ZodType<Output>,
  operation: ApiOperation,
) {
  let response: Response

  try {
    response = await request
  } catch (error) {
    if (isAbortError(error)) throw error
    throw normalizeTransportError(error, operation)
  }

  let body: unknown

  try {
    body = await response.json()
  } catch (error) {
    throw new ApiError({
      kind: 'schema',
      status: response.status,
      requestId: requestIdFromHeaders(response.headers),
      retryable: false,
      safeMessage: SCHEMA_SAFE_MESSAGE,
      cause: error,
    })
  }

  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError({
      kind: 'schema',
      status: response.status,
      requestId: requestIdFromHeaders(response.headers),
      retryable: false,
      safeMessage: SCHEMA_SAFE_MESSAGE,
      cause: parsed.error,
    })
  }

  return parsed.data
}
