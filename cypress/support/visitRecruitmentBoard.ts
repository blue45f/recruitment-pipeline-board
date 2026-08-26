import { BOARD_PREFERENCES_STORAGE_KEY } from '../../src/domains/recruitment/board/model/boardPreferences'
import type { CandidateListSize } from '../../src/domains/recruitment/candidates/model'

type StableMockApiVisitOptions = Readonly<{
  listSize?: CandidateListSize
  rootFontSizePx?: number
  storageMode?: 'preserve' | 'reset'
}>

export function visitRecruitmentBoardWithStableMockApi({
  listSize,
  rootFontSizePx,
  storageMode = 'reset',
}: StableMockApiVisitOptions = {}) {
  return cy.visit('/', {
    onBeforeLoad(window) {
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
            Reflect.set(values, 0, 0xffffffff)
          }

          return values
        },
      })
    },
  })
}
