import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'

const DESKTOP_VIEWPORT = { height: 900, width: 1440 } as const
const MOBILE_VIEWPORT = { height: 844, width: 390 } as const

function waitForStableBoard() {
  cy.contains('h1', '채용 후보자 보드').should('be.visible')
  cy.get('[aria-label="채용 단계별 후보자 보드"] h2').should('have.length', 5)
  cy.contains('[role="status"]', '전체 200명 중 200명을 표시합니다.').should(
    'be.visible',
  )
  cy.get('[data-candidate-id]').its('length').should('be.greaterThan', 0)
  cy.document().then(async (document) => {
    await document.fonts.ready

    const style = document.createElement('style')
    style.dataset.visualRegression = 'true'
    style.textContent = `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition: none !important;
      }
    `
    document.head.append(style)
  })
  cy.window().then((window) => window.scrollTo(0, 0))
  cy.get<HTMLElement>('[aria-label="채용 단계별 후보자 보드"]').then(
    ($board) => {
      $board.get(0).scrollTo(0, 0)
    },
  )
  cy.get<HTMLElement>('[role="list"]').each(($list) => {
    $list.get(0).scrollTo(0, 0)
  })
}

function openFirstCandidateDetail() {
  cy.get<HTMLButtonElement>('[data-candidate-id]').first().click()
  cy.get('[role="dialog"] [aria-label$="후보자 상세 정보"]', {
    timeout: 5_000,
  }).should('be.visible')
  cy.get<HTMLElement>('[role="dialog"]').then(($dialog) => {
    $dialog.get(0).scrollTo(0, 0)
  })
}

describe('recruitment board visual regression', () => {
  it('데스크톱 보드 기준 화면과 일치한다', () => {
    cy.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height)
    visitRecruitmentBoardWithStableMockApi()
    waitForStableBoard()

    cy.compareSnapshot('board-desktop')
  })

  it('모바일 보드 기준 화면과 일치한다', () => {
    cy.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    visitRecruitmentBoardWithStableMockApi()
    waitForStableBoard()

    cy.compareSnapshot('board-mobile')
  })

  it('데스크톱 상세 기준 화면과 일치한다', () => {
    cy.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height)
    visitRecruitmentBoardWithStableMockApi()
    waitForStableBoard()
    openFirstCandidateDetail()

    cy.compareSnapshot('detail-desktop')
  })

  it('모바일 상세 기준 화면과 일치한다', () => {
    cy.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    visitRecruitmentBoardWithStableMockApi()
    waitForStableBoard()
    openFirstCandidateDetail()

    cy.compareSnapshot('detail-mobile')
  })
})
