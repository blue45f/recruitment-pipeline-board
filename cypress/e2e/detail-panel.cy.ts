function visitWithStableMockApi() {
  cy.visit('/', {
    onBeforeLoad(window) {
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

describe('candidate detail panel', () => {
  it('상세를 열고 접근성 검사를 통과한 뒤 원래 카드로 돌아간다', () => {
    cy.viewport(1440, 900)
    visitWithStableMockApi()

    cy.get<HTMLButtonElement>('[data-candidate-id]')
      .first()
      .should('be.visible')
      .then(($card) => {
        const candidateId = $card.attr('data-candidate-id')
        const candidateName = $card.attr('aria-label')?.split(' 후보자,')[0]

        expect(candidateId).to.be.a('string')
        expect(candidateId?.length ?? 0).to.be.greaterThan(0)
        expect(candidateName).to.be.a('string')
        expect(candidateName?.length ?? 0).to.be.greaterThan(0)

        cy.wrap($card).click()
        cy.get('[role="dialog"]')
          .should('be.visible')
          .and('contain.text', `${candidateName} 후보자 상세`)
        cy.get(
          '[role="dialog"] [role="status"][aria-label="후보자 상세 정보를 불러오는 중입니다"]',
        ).should('be.visible')
        cy.get(
          `[role="dialog"] [aria-label="${candidateName} 후보자 상세 정보"]`,
          { timeout: 5_000 },
        ).should('be.visible')

        cy.injectAxe()
        cy.checkA11y('[role="dialog"]')
        cy.screenshot('detail-panel/desktop')
        cy.get('body').type('{esc}')
        cy.get('[role="dialog"]').should('not.exist')
        cy.focused()
          .should('have.attr', 'data-candidate-id', candidateId)
          .and('have.attr', 'aria-haspopup', 'dialog')
      })
  })

  it('모바일에서 문서와 상세 패널에 가로 넘침을 만들지 않는다', () => {
    cy.viewport(390, 844)
    visitWithStableMockApi()

    cy.get<HTMLButtonElement>('[data-candidate-id]').first().click()
    cy.get('[role="dialog"] [aria-label$="후보자 상세 정보"]', {
      timeout: 5_000,
    }).should('be.visible')
    cy.window().then((browserWindow) => {
      expect(browserWindow.document.documentElement.scrollWidth).to.be.at.most(
        browserWindow.document.documentElement.clientWidth,
      )
    })
    cy.get('[role="dialog"]').then(($dialog) => {
      const dialog = $dialog.get(0)

      expect(dialog.scrollWidth).to.equal(dialog.clientWidth)
    })
    cy.get('[role="dialog"] button[aria-label="닫기"]').then(($button) => {
      const { height, width } = $button.get(0).getBoundingClientRect()

      expect(width).to.be.at.least(44)
      expect(height).to.be.at.least(44)
    })
    cy.screenshot('detail-panel/mobile')
  })
})
