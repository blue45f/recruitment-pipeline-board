import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'
import {
  cancelCandidatePointerDrag,
  startCandidatePointerDrag,
} from '../support/candidatePointerDrag'

const BOARD_SELECTOR = '[aria-label="채용 단계별 후보자 보드"]'
const CANDIDATE_SELECTOR = '[data-candidate-id]'
const VIRTUAL_LIST_SELECTOR = '[data-virtualized-candidate-list]'
const VIRTUAL_ITEM_SELECTOR = '[data-virtualized-candidate-item]'

function selectThousandCandidates() {
  cy.contains('label', /^표시할 데이터$/)
    .invoke('attr', 'id')
    .then((labelId) => {
      expect(labelId).to.be.a('string')
      expect(labelId).not.to.equal('')

      cy.get(`[role="combobox"][aria-labelledby~="${labelId}"]`).click()
    })
  cy.contains('[role="option"]', '후보자 1,000명 · 가상 목록').click()
  cy.contains('[role="status"]', '전체 1,000명 중 1,000명을 표시합니다.', {
    timeout: 10_000,
  }).should('be.visible')
}

function assertVirtualizedCandidateBudget() {
  cy.get(VIRTUAL_LIST_SELECTOR).should('have.length', 5)
  cy.get(`${BOARD_SELECTOR} ${VIRTUAL_ITEM_SELECTOR}`)
    .its('length')
    .should('be.lte', 60)
  cy.get(VIRTUAL_LIST_SELECTOR).each(($list) => {
    cy.wrap($list)
      .find(VIRTUAL_ITEM_SELECTOR)
      .its('length')
      .should('be.lte', 12)
    cy.wrap($list)
      .find(VIRTUAL_ITEM_SELECTOR)
      .first()
      .should('have.attr', 'aria-setsize', '200')
  })
}

describe('virtualized candidate board', () => {
  it('1,000명 목록을 제한된 DOM으로 렌더링하고 마지막 후보자까지 탐색한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi()

    selectThousandCandidates()
    assertVirtualizedCandidateBudget()

    cy.get<HTMLElement>(VIRTUAL_LIST_SELECTOR).first().as('firstStageList')
    cy.get('@firstStageList')
      .find<HTMLButtonElement>(`${CANDIDATE_SELECTOR}[tabindex="0"]`)
      .as('firstStageTabStop')
      .focus()
    cy.press(Cypress.Keyboard.Keys.END)

    cy.focused()
      .should('match', CANDIDATE_SELECTOR)
      .closest(VIRTUAL_ITEM_SELECTOR)
      .should('have.attr', 'aria-posinset', '200')
      .and('have.attr', 'aria-setsize', '200')

    cy.focused()
      .invoke('attr', 'data-candidate-id')
      .then((candidateId) => {
        expect(candidateId).to.be.a('string')
        expect(candidateId).not.to.equal('')

        cy.focused().click()
        cy.get('[role="dialog"] [aria-label$="후보자 상세 정보"]', {
          timeout: 5_000,
        }).should('be.visible')
        cy.get('body').type('{esc}')
        cy.get('[role="dialog"]').should('not.exist')
        cy.focused().should('have.attr', 'data-candidate-id', candidateId)
      })

    cy.get('@firstStageList').then(($list) => {
      expect(($list.get(0) as HTMLElement).scrollTop).to.be.greaterThan(0)
    })

    cy.injectAxe()
    cy.checkA11y('main')
  })

  it('드래그 중인 후보자는 가상 범위 밖으로 스크롤해도 유지한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi({
      listSize: 1_000,
      stubPointerCapture: true,
    })

    cy.contains('[role="status"]', '전체 1,000명 중 1,000명을 표시합니다.', {
      timeout: 8_000,
    }).should('be.visible')
    cy.get<HTMLElement>(VIRTUAL_LIST_SELECTOR).first().as('dragSourceList')
    cy.get('@dragSourceList')
      .find<HTMLButtonElement>('[data-candidate-drag-handle]')
      .eq(1)
      .invoke('attr', 'data-candidate-drag-handle')
      .then((candidateId) => {
        expect(candidateId).to.be.a('string').and.not.equal('')

        const id = String(candidateId)

        startCandidatePointerDrag(id).then(() => {
          cy.get('@dragSourceList').scrollTo('bottom', { duration: 0 })
          cy.get(`[data-candidate-drag-handle="${id}"]`)
            .should('exist')
            .closest('[data-candidate-dragging="true"]')
            .should('exist')
          cy.get('@dragSourceList')
            .find(VIRTUAL_ITEM_SELECTOR)
            .its('length')
            .should('be.lte', 13)

          cancelCandidatePointerDrag()
          cy.get(`[data-candidate-drag-handle="${id}"]`).should('not.exist')
        })
      })
  })

  it('포커스한 채 스크롤한 뒤 목록을 떠나도 현재 위치의 tab stop을 복구한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi({ listSize: 1_000 })

    cy.contains('[role="status"]', '전체 1,000명 중 1,000명을 표시합니다.', {
      timeout: 8_000,
    }).should('be.visible')
    cy.get<HTMLElement>(VIRTUAL_LIST_SELECTOR).first().as('scrolledStageList')
    cy.get('@scrolledStageList')
      .find(`${CANDIDATE_SELECTOR}[tabindex="0"]`)
      .as('focusedBeforeScroll')
      .focus()
    cy.get('@scrolledStageList').scrollTo(0, 3_000)
    cy.get(BOARD_SELECTOR).focus()
    cy.get('@scrolledStageList').within(() => {
      cy.get<HTMLButtonElement>(`${CANDIDATE_SELECTOR}[tabindex="0"]`)
        .should('have.length', 1)
        .should(($button) => {
          const listItem = $button.get(0).closest(VIRTUAL_ITEM_SELECTOR)

          expect(
            Number(listItem?.getAttribute('aria-posinset')),
          ).to.be.greaterThan(1)
        })
    })
    cy.press(Cypress.Keyboard.Keys.TAB)
    cy.focused()
      .should('match', CANDIDATE_SELECTOR)
      .closest(VIRTUAL_ITEM_SELECTOR)
      .should(($item) => {
        expect(Number($item.attr('aria-posinset'))).to.be.greaterThan(1)
      })
    cy.get('@scrolledStageList').then(($list) => {
      expect(($list.get(0) as HTMLElement).scrollTop).to.be.greaterThan(0)
    })
  })

  it('모바일 문서 폭은 유지하고 보드 안에서만 두 축을 스크롤한다', () => {
    cy.viewport(390, 844)
    visitRecruitmentBoardWithStableMockApi({ listSize: 1_000 })

    cy.contains('[role="status"]', '전체 1,000명 중 1,000명을 표시합니다.', {
      timeout: 8_000,
    }).should('be.visible')
    assertVirtualizedCandidateBudget()

    cy.window().then((browserWindow) => {
      const { documentElement } = browserWindow.document

      expect(documentElement.scrollWidth).to.be.at.most(
        documentElement.clientWidth,
      )
    })
    cy.get<HTMLElement>(BOARD_SELECTOR).then(($board) => {
      const board = $board.get(0)

      expect(board.scrollWidth).to.be.greaterThan(board.clientWidth)
    })
    cy.get<HTMLElement>(VIRTUAL_LIST_SELECTOR)
      .first()
      .then(($list) => {
        const list = $list.get(0)

        expect(list.scrollHeight).to.be.greaterThan(list.clientHeight)
      })
  })

  it('확대된 기본 글꼴에서도 가상 행을 실제 카드 높이에 맞춘다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi({
      listSize: 1_000,
      rootFontSizePx: 20,
    })

    cy.contains('[role="status"]', '전체 1,000명 중 1,000명을 표시합니다.', {
      timeout: 8_000,
    }).should('be.visible')
    cy.get<HTMLElement>(VIRTUAL_LIST_SELECTOR)
      .first()
      .find(VIRTUAL_ITEM_SELECTOR)
      .should(($items) => {
        expect($items.length).to.be.greaterThan(1)

        const firstItem = $items.get(0).getBoundingClientRect()
        const secondItem = $items.get(1).getBoundingClientRect()

        expect(firstItem.height).to.be.at.least(200)
        expect(secondItem.top).to.be.at.least(firstItem.bottom)
      })
  })
})
