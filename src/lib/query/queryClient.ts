import { QueryClient } from '@tanstack/react-query'

const API_ERROR_KINDS = new Set([
  'http',
  'network',
  'timeout',
  'schema',
  'unknown',
])

type ApiErrorMetadata = Error & {
  kind: string
  retryable: boolean
  safeMessage: string
  status: number | undefined
}

function hasApiErrorMetadata(error: unknown): error is ApiErrorMetadata {
  if (!(error instanceof Error) || error.name !== 'ApiError') {
    return false
  }

  const candidate = error as Partial<ApiErrorMetadata>

  return (
    typeof candidate.kind === 'string' &&
    API_ERROR_KINDS.has(candidate.kind) &&
    typeof candidate.retryable === 'boolean' &&
    typeof candidate.safeMessage === 'string' &&
    'status' in candidate &&
    (candidate.status === undefined || typeof candidate.status === 'number')
  )
}

function shouldRetryQuery(failureCount: number, error: unknown) {
  return (
    failureCount < 1 &&
    hasApiErrorMetadata(error) &&
    error.retryable &&
    error.kind !== 'schema' &&
    error.status !== 404
  )
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5 * 60 * 1_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const queryClient = createQueryClient()
