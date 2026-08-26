import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CANDIDATE_MOCK_LEGACY_STORAGE_KEY,
  CANDIDATE_MOCK_STORAGE_KEY,
  createBrowserCandidateMockStorage,
} from './index'

beforeEach(() => {
  window.localStorage.clear()
})

describe('browser candidate mock storage', () => {
  it('새 adapter를 만들어도 같은 localStorage 값을 읽는다', () => {
    createBrowserCandidateMockStorage().write('{"version":2}')

    expect(createBrowserCandidateMockStorage().read()).toBe('{"version":2}')
    expect(window.localStorage.getItem(CANDIDATE_MOCK_STORAGE_KEY)).toBe(
      '{"version":2}',
    )
  })

  it('저장된 값을 제거한다', () => {
    const storage = createBrowserCandidateMockStorage()
    storage.write('persisted')

    storage.remove()

    expect(storage.read()).toBeNull()
  })

  it('v2 키가 없으면 v1 키를 읽고 다음 저장에서 이전한다', () => {
    window.localStorage.setItem(
      CANDIDATE_MOCK_LEGACY_STORAGE_KEY,
      '{"version":1}',
    )
    const storage = createBrowserCandidateMockStorage()

    expect(storage.read()).toBe('{"version":1}')

    storage.write('{"version":2}')

    expect(window.localStorage.getItem(CANDIDATE_MOCK_STORAGE_KEY)).toBe(
      '{"version":2}',
    )
    expect(
      window.localStorage.getItem(CANDIDATE_MOCK_LEGACY_STORAGE_KEY),
    ).toBeNull()
  })

  it('v2 저장 뒤 legacy 정리에 실패해도 성공한 commit을 되돌리지 않는다', () => {
    window.localStorage.setItem(
      CANDIDATE_MOCK_LEGACY_STORAGE_KEY,
      '{"version":1}',
    )
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementationOnce(() => {
        throw new DOMException('legacy cleanup denied', 'SecurityError')
      })

    expect(() =>
      createBrowserCandidateMockStorage().write('{"version":2}'),
    ).not.toThrow()
    expect(window.localStorage.getItem(CANDIDATE_MOCK_STORAGE_KEY)).toBe(
      '{"version":2}',
    )
    expect(window.localStorage.getItem(CANDIDATE_MOCK_LEGACY_STORAGE_KEY)).toBe(
      '{"version":1}',
    )

    removeItem.mockRestore()
  })

  it('초기화할 때 v1과 v2 키를 함께 제거한다', () => {
    window.localStorage.setItem(
      CANDIDATE_MOCK_LEGACY_STORAGE_KEY,
      '{"version":1}',
    )
    window.localStorage.setItem(CANDIDATE_MOCK_STORAGE_KEY, '{"version":2}')

    createBrowserCandidateMockStorage().remove()

    expect(
      window.localStorage.getItem(CANDIDATE_MOCK_LEGACY_STORAGE_KEY),
    ).toBeNull()
    expect(window.localStorage.getItem(CANDIDATE_MOCK_STORAGE_KEY)).toBeNull()
  })

  it('Web Locks가 없으면 안전하지 않은 탭 간 저장을 시도하지 않는다', async () => {
    const storage = createBrowserCandidateMockStorage()
    const operation = vi.fn(() => 'should-not-run')

    await expect(storage.runExclusive(operation)).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
    expect(operation).not.toHaveBeenCalled()
  })
})
