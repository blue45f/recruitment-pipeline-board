import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'

function waitForCandidateBoard() {
  cy.contains('[role="status"]', '전체 200명 중 200명을 표시합니다.').should(
    'be.visible',
  )
  cy.get('[data-virtualized-candidate-list]')
    .should('have.length', 5)
    .each(($list) => {
      cy.wrap($list)
        .find('[data-virtualized-candidate-item]')
        .should('have.length.greaterThan', 0)
    })
}

describe('recruitment board layout', () => {
  it('데스크톱에 다섯 채용 단계를 같은 흐름으로 표시한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi()

    cy.contains('h1', '채용 후보자 보드').should('be.visible')
    waitForCandidateBoard()
    cy.get('[aria-label="채용 단계별 후보자 보드"] h2').should('have.length', 5)
  })

  it('모바일 문서에는 의도하지 않은 가로 스크롤을 만들지 않는다', () => {
    cy.viewport(390, 844)
    visitRecruitmentBoardWithStableMockApi()
    waitForCandidateBoard()

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

  it('중간 화면에서 데이터 선택과 초기화 버튼의 하단을 맞춘다', () => {
    cy.viewport(1024, 900)
    visitRecruitmentBoardWithStableMockApi()
    waitForCandidateBoard()

    cy.contains('label', /^표시할 데이터$/)
      .invoke('attr', 'id')
      .then((labelId) => {
        cy.get(`[role="combobox"][aria-labelledby~="${labelId}"]`).then(
          ($listSizeSelect) => {
            cy.contains('button', /^필터 초기화$/).then(($resetButton) => {
              const selectRect = $listSizeSelect.get(0).getBoundingClientRect()
              const buttonRect = $resetButton.get(0).getBoundingClientRect()

              expect(
                Math.abs(selectRect.bottom - buttonRect.bottom),
              ).to.be.at.most(1)
              expect(buttonRect.left).to.be.greaterThan(selectRect.right)
            })
          },
        )
      })
  })
})
