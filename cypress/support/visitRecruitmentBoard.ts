import { BOARD_PREFERENCES_STORAGE_KEY } from '../../src/domains/recruitment/board/model/boardPreferences'
import type { CandidateListSize } from '../../src/domains/recruitment/candidates/model'

type StableMockApiVisitOptions = Readonly<{
  listSize?: CandidateListSize
  mockRandomValues?: readonly number[]
  rootFontSizePx?: number
  storageMode?: 'preserve' | 'reset'
}>

export function visitRecruitmentBoardWithStableMockApi({
  listSize,
  mockRandomValues,
  rootFontSizePx,
  storageMode = 'reset',
}: StableMockApiVisitOptions = {}) {
  return cy.visit('/', {
    onBeforeLoad(window) {
      let mockRandomValueIndex = 0

      Object.defineProperties(window.HTMLElement.prototype, {
        releasePointerCapture: {
          configurable: true,
          value: () => undefined,
        },
        setPointerCapture: {
          configurable: true,
          value: () => undefined,
        },
      })

      if (storageMode === 'reset') {
        window.localStorage.clear()
      }

      if (rootFontSizePx !== undefined) {
        window.document.documentElement.style.fontSize = `${rootFontSizePx}px`
      }

      if (listSize !== undefined) {
        window.localStorage.setItem(
          BOARD_PREFERENCES_STORAGE_KEY,
          JSON.stringify({ state: { listSize }, version: 1 }),
        )
      }

      Object.defineProperty(window.crypto, 'getRandomValues', {
        configurable: true,
        value<T extends ArrayBufferView | null>(values: T) {
          if (values !== null) {
            const nextValue =
              mockRandomValues?.[mockRandomValueIndex] ?? 0xffffffff

            mockRandomValueIndex += 1
            Reflect.set(values, 0, nextValue)
          }

          return values
        },
      })
    },
  })
}
