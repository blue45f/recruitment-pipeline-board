export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'schema' | 'unknown'

type ApiErrorOptions = {
  kind: ApiErrorKind
  status: number | undefined
  requestId: string | undefined
  retryable: boolean
  safeMessage: string
  cause: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly requestId: string | undefined
  readonly retryable: boolean
  readonly safeMessage: string

  constructor(options: ApiErrorOptions) {
    super(options.safeMessage, { cause: options.cause })
    this.name = 'ApiError'
    this.kind = options.kind
    this.status = options.status
    this.requestId = options.requestId
    this.retryable = options.retryable
    this.safeMessage = options.safeMessage
  }
}
