import ky, { type KyInstance } from 'ky'

const DEFAULT_TIMEOUT = 5_000

type CreateCandidateHttpClientOptions = {
  prefixUrl?: string
  timeout?: number
  fetch?: typeof globalThis.fetch
}

function defaultPrefixUrl() {
  if (typeof window !== 'undefined') {
    return new URL('/api/', window.location.origin).toString()
  }

  return 'http://localhost/api/'
}

export function createCandidateHttpClient({
  prefixUrl = defaultPrefixUrl(),
  timeout = DEFAULT_TIMEOUT,
  fetch,
}: CreateCandidateHttpClientOptions = {}): KyInstance {
  return ky.create({
    prefix: prefixUrl,
    timeout,
    retry: 0,
    ...(fetch === undefined ? {} : { fetch }),
  })
}
