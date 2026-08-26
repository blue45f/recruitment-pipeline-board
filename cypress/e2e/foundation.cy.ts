describe('project foundation', () => {
  it('접근 가능한 준비 화면을 표시한다', () => {
    cy.visit('/')
    cy.injectAxe()

    cy.contains('h1', '채용의 흐름을').should('be.visible')
    cy.contains('h1', '더 선명하게').should('be.visible')
    cy.get('[role="status"]').should(
      'contain.text',
      '공용 UI와 채용 보드 기능을 순서대로 연결하고 있습니다.',
    )
    cy.checkA11y()
  })
})
