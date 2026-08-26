export const CANDIDATE_MOCK_STORAGE_KEY =
  'recruitment-pipeline-board:candidate-mutations:v1'

export type CandidateMockStorage = {
  read: () => string | null
  write: (value: string) => void
  remove: () => void
}

export function createMemoryCandidateMockStorage(
  initialValue: string | null = null,
): CandidateMockStorage {
  let value = initialValue

  return {
    read: () => value,
    write: (nextValue) => {
      value = nextValue
    },
    remove: () => {
      value = null
    },
  }
}

export function createBrowserCandidateMockStorage(
  key = CANDIDATE_MOCK_STORAGE_KEY,
): CandidateMockStorage {
  return {
    read: () => window.localStorage.getItem(key),
    write: (value) => window.localStorage.setItem(key, value),
    remove: () => window.localStorage.removeItem(key),
  }
}
