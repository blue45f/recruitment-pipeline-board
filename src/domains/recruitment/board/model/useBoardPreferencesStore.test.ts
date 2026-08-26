import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { CandidateListSize } from '../../candidates/model'
import {
  BOARD_PREFERENCES_STORAGE_KEY,
  useBoardPreferencesStore,
} from './useBoardPreferencesStore'

beforeEach(() => {
  localStorage.clear()
  useBoardPreferencesStore.setState({ listSize: 200 })
})

afterEach(() => {
  localStorage.clear()
  useBoardPreferencesStore.setState({ listSize: 200 })
})

describe('useBoardPreferencesStore', () => {
  it('선택한 목록 크기를 저장하고 새 상태에 복원한다', async () => {
    useBoardPreferencesStore.getState().setListSize(1_000)

    expect(useBoardPreferencesStore.getState().listSize).toBe(1_000)
    expect(
      JSON.parse(localStorage.getItem(BOARD_PREFERENCES_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ state: { listSize: 1_000 }, version: 1 })
    const persistedPreferences = localStorage.getItem(
      BOARD_PREFERENCES_STORAGE_KEY,
    )

    useBoardPreferencesStore.setState({ listSize: 200 })

    if (persistedPreferences) {
      localStorage.setItem(BOARD_PREFERENCES_STORAGE_KEY, persistedPreferences)
    }

    await useBoardPreferencesStore.persist.rehydrate()

    expect(useBoardPreferencesStore.getState().listSize).toBe(1_000)
  })

  it('계약에 없는 목록 크기는 저장하지 않는다', () => {
    expect(() =>
      useBoardPreferencesStore.getState().setListSize(500 as CandidateListSize),
    ).toThrow()
    expect(useBoardPreferencesStore.getState().listSize).toBe(200)
  })

  it('손상된 저장값은 기본 목록 크기로 복구한다', async () => {
    localStorage.setItem(
      BOARD_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ state: { listSize: 500 }, version: 1 }),
    )

    await useBoardPreferencesStore.persist.rehydrate()

    expect(useBoardPreferencesStore.getState().listSize).toBe(200)
  })
})
