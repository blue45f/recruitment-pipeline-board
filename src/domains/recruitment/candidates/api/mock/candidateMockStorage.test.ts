import { beforeEach, describe, expect, it } from 'vitest'

import {
  CANDIDATE_MOCK_STORAGE_KEY,
  createBrowserCandidateMockStorage,
} from './index'

beforeEach(() => {
  window.localStorage.clear()
})

describe('browser candidate mock storage', () => {
  it('새 adapter를 만들어도 같은 localStorage 값을 읽는다', () => {
    createBrowserCandidateMockStorage().write('{"version":1}')

    expect(createBrowserCandidateMockStorage().read()).toBe('{"version":1}')
    expect(window.localStorage.getItem(CANDIDATE_MOCK_STORAGE_KEY)).toBe(
      '{"version":1}',
    )
  })

  it('저장된 값을 제거한다', () => {
    const storage = createBrowserCandidateMockStorage()
    storage.write('persisted')

    storage.remove()

    expect(storage.read()).toBeNull()
  })
})
