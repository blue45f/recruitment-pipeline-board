import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'

import {
  candidateListSizeSchema,
  type CandidateListSize,
} from '../../candidates/model'

import { BOARD_PREFERENCES_STORAGE_KEY } from './boardPreferences'

export { BOARD_PREFERENCES_STORAGE_KEY }

const persistedBoardPreferencesSchema = z
  .object({
    listSize: candidateListSizeSchema,
  })
  .strict()

type BoardPreferencesState = {
  listSize: CandidateListSize
  setListSize: (listSize: CandidateListSize) => void
}

export const useBoardPreferencesStore = create<BoardPreferencesState>()(
  persist(
    (set) => ({
      listSize: 200,
      setListSize: (rawListSize) => {
        const listSize = candidateListSizeSchema.parse(rawListSize)

        set({ listSize })
      },
    }),
    {
      merge: (persistedState, currentState) => {
        const result = persistedBoardPreferencesSchema.safeParse(persistedState)

        return result.success
          ? { ...currentState, listSize: result.data.listSize }
          : currentState
      },
      name: BOARD_PREFERENCES_STORAGE_KEY,
      partialize: ({ listSize }) => ({ listSize }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)
