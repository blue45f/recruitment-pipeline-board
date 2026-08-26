import type { CandidateApiErrorCode } from '../../model'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'schema' | 'unknown'

type ApiErrorOptions = {
  kind: ApiErrorKind
  code?: CandidateApiErrorCode | undefined
  status: number | undefined
  requestId: string | undefined
  retryable: boolean
  safeMessage: string
  cause: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly code: CandidateApiErrorCode | undefined
  readonly status: number | undefined
  readonly requestId: string | undefined
  readonly retryable: boolean
  readonly safeMessage: string

  constructor(options: ApiErrorOptions) {
    super(options.safeMessage, { cause: options.cause })
    this.name = 'ApiError'
    this.kind = options.kind
    this.code = options.code
    this.status = options.status
    this.requestId = options.requestId
    this.retryable = options.retryable
    this.safeMessage = options.safeMessage
  }
}
