import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'

const SOURCE_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-document_review"]'
const TARGET_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-interview"]'

describe('candidate stage move', () => {
  it('단계를 저장하고 다시 방문해도 확정 결과를 유지한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi({ storageMode: 'reset' })

    cy.contains('[role="status"]', '전체 200명 중 200명을 표시합니다.', {
      timeout: 5_000,
    }).should('be.visible')
    cy.get<HTMLButtonElement>(
      `${SOURCE_STAGE_SELECTOR} [data-stage-change-candidate-id]`,
    )
      .first()
      .should('be.visible')
      .then(($button) => {
        const candidateId = $button.attr('data-stage-change-candidate-id')
        const candidateName = $button.attr('aria-label')?.split(' 후보자 ')[0]

        expect(candidateId).to.be.a('string').and.not.equal('')
        expect(candidateName).to.be.a('string').and.not.equal('')

        cy.wrap(candidateId).as('candidateId')
        cy.wrap(candidateName).as('candidateName')
        cy.wrap($button).click()
      })

    cy.get('@candidateName').then((candidateName) => {
      cy.get('[role="dialog"]')
        .should('be.visible')
        .and('have.attr', 'aria-labelledby')
      cy.contains(
        '[role="dialog"] h2',
        `${String(candidateName)} 후보자 단계 변경`,
      ).should('be.visible')
    })
    cy.get('[role="dialog"] input[type="radio"]').should('have.length', 4)
    cy.get(
      '[role="dialog"] input[type="radio"][value="document_review"]',
    ).should('not.exist')
    cy.injectAxe()
    cy.checkA11y('[role="dialog"]')

    cy.get('[role="dialog"] input[type="radio"][value="interview"]').check()
    cy.contains('[role="dialog"] button', /^변경하기$/).click()

    cy.get('@candidateName').then((candidateName) => {
      cy.contains(
        '[data-sonner-toast]',
        `${String(candidateName)} 후보자를 면접 단계로 이동했습니다.`,
        { timeout: 5_000 },
      ).should('be.visible')
    })
    cy.get('@candidateId').then((candidateId) => {
      cy.get(
        `${TARGET_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('be.visible')
      cy.get(
        `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('not.exist')
    })

    visitRecruitmentBoardWithStableMockApi({ storageMode: 'preserve' })

    cy.contains('[role="status"]', '전체 200명 중 200명을 표시합니다.', {
      timeout: 5_000,
    }).should('be.visible')
    cy.get('@candidateId').then((candidateId) => {
      cy.get<HTMLButtonElement>(
        `${TARGET_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      )
        .should('be.visible')
        .click()
    })
    cy.get('[role="dialog"] [aria-label$="후보자 상세 정보"]', {
      timeout: 5_000,
    }).should('be.visible')
    cy.contains('[role="dialog"] dt', /^현재 단계$/)
      .next('dd')
      .should('have.text', '면접')
    cy.injectAxe()
    cy.checkA11y('[role="dialog"]')
  })
})
