export const CANDIDATE_MOCK_STORAGE_KEY =
  'recruitment-pipeline-board:candidate-mutations:v2'
export const CANDIDATE_MOCK_LEGACY_STORAGE_KEY =
  'recruitment-pipeline-board:candidate-mutations:v1'

export type CandidateMockStorage = {
  read: () => string | null
  remove: () => void
  runExclusive: <Result>(
    operation: () => Promise<Result> | Result,
  ) => Promise<Result>
  write: (value: string) => void
}

const fallbackLockTailByName = new Map<string, Promise<void>>()

async function runOperation<Result>(
  operation: () => Promise<Result> | Result,
): Promise<Result> {
  return await operation()
}

async function runWithFallbackLock<Result>(
  lockName: string,
  operation: () => Promise<Result> | Result,
) {
  const previous = fallbackLockTailByName.get(lockName) ?? Promise.resolve()
  let release: () => void = () => undefined
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => current)

  fallbackLockTailByName.set(lockName, tail)
  await previous

  try {
    return await operation()
  } finally {
    release()

    if (fallbackLockTailByName.get(lockName) === tail) {
      fallbackLockTailByName.delete(lockName)
    }
  }
}

export function createMemoryCandidateMockStorage(
  initialValue: string | null = null,
): CandidateMockStorage {
  let value = initialValue
  const lockName = `candidate-memory-storage:${crypto.randomUUID()}`

  return {
    read: () => value,
    write: (nextValue) => {
      value = nextValue
    },
    remove: () => {
      value = null
    },
    runExclusive: (operation) => runWithFallbackLock(lockName, operation),
  }
}

export function createBrowserCandidateMockStorage(
  key = CANDIDATE_MOCK_STORAGE_KEY,
  legacyKey = key === CANDIDATE_MOCK_STORAGE_KEY
    ? CANDIDATE_MOCK_LEGACY_STORAGE_KEY
    : undefined,
): CandidateMockStorage {
  const lockName = `${key}:exclusive-write`
  async function runExclusive<Result>(
    operation: () => Promise<Result> | Result,
  ): Promise<Result> {
    if (navigator.locks === undefined) {
      throw new DOMException(
        '이 브라우저에서는 안전한 Mock API 저장을 지원하지 않습니다.',
        'NotSupportedError',
      )
    }

    return await navigator.locks.request<Promise<Result>>(lockName, () =>
      runOperation(operation),
    )
  }

  return {
    read: () =>
      window.localStorage.getItem(key) ??
      (legacyKey === undefined ? null : window.localStorage.getItem(legacyKey)),
    write: (value) => {
      window.localStorage.setItem(key, value)

      if (legacyKey !== undefined) {
        try {
          window.localStorage.removeItem(legacyKey)
        } catch {
          // The v2 value is already authoritative. Legacy cleanup is best effort.
        }
      }
    },
    remove: () => {
      window.localStorage.removeItem(key)

      if (legacyKey !== undefined) {
        window.localStorage.removeItem(legacyKey)
      }
    },
    runExclusive,
  }
}
