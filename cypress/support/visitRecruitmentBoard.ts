export function visitRecruitmentBoardWithStableMockApi() {
  return cy.visit('/', {
    onBeforeLoad(window) {
      window.localStorage.clear()

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
