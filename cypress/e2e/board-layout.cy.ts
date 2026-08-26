import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'

describe('recruitment board layout', () => {
  it('데스크톱에 다섯 채용 단계를 같은 흐름으로 표시한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi()

    cy.contains('h1', '채용 후보자 보드').should('be.visible')
    cy.get('[aria-label="채용 단계별 후보자 보드"] h2').should('have.length', 5)
  })

  it('모바일 문서에는 의도하지 않은 가로 스크롤을 만들지 않는다', () => {
    cy.viewport(390, 844)
    visitRecruitmentBoardWithStableMockApi()

    cy.window().then((browserWindow) => {
      expect(browserWindow.document.documentElement.scrollWidth).to.be.at.most(
        browserWindow.document.documentElement.clientWidth,
      )
    })
    cy.get('[aria-label="채용 단계별 후보자 보드"]').then(($board) => {
      const board = $board.get(0)

      expect(board.scrollWidth).to.be.greaterThan(board.clientWidth)
    })
  })
})
