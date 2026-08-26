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

    cy.get('@candidateId').then((candidateId) => {
      cy.document().then((document) => {
        const id = String(candidateId)
        const optimisticCard = document.querySelector(
          `${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
        )

        expect(
          document.querySelector(
            `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
          ),
        ).to.equal(null)
        expect(optimisticCard).not.to.equal(null)
        expect(
          document
            .querySelector(`[data-stage-change-candidate-id="${id}"]`)
            ?.getAttribute('aria-busy'),
        ).to.equal('true')
        expect(document.querySelector('[role="dialog"]')).to.equal(null)
      })
    })

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
    cy.get('[data-virtualized-candidate-list]').each(($list) => {
      cy.wrap($list).find('button[tabindex="0"]').should('have.length', 1)
    })
    cy.injectAxe()
    cy.checkA11y('main')

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

  it('상세 안에서 실패를 알리고 같은 경로로 다시 시도한다', () => {
    cy.viewport(1440, 900)
    visitRecruitmentBoardWithStableMockApi({
      mockRandomValues: [
        0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0,
        0xffffffff, 0xffffffff,
      ],
      storageMode: 'reset',
    })

    cy.contains('[role="status"]', '전체 200명 중 200명을 표시합니다.', {
      timeout: 5_000,
    }).should('be.visible')
    cy.get<HTMLButtonElement>(`${SOURCE_STAGE_SELECTOR} [data-candidate-id]`)
      .first()
      .should('be.visible')
      .then(($button) => {
        const candidateId = $button.attr('data-candidate-id')
        const candidateName = $button.attr('aria-label')?.split(' 후보자,')[0]

        expect(candidateId).to.be.a('string').and.not.equal('')
        expect(candidateName).to.be.a('string').and.not.equal('')

        cy.wrap(candidateId).as('failedCandidateId')
        cy.wrap(candidateName).as('failedCandidateName')
        cy.wrap($button).click()
      })

    cy.get('@failedCandidateId').then((candidateId) => {
      cy.get(
        `[role="dialog"] [data-stage-change-candidate-id="${String(candidateId)}"]`,
      ).click()
    })
    cy.get('@failedCandidateName').then((candidateName) => {
      cy.contains(
        '[role="dialog"] h2',
        `${String(candidateName)} 후보자 단계 변경`,
      )
        .closest('[role="dialog"]')
        .within(() => {
          cy.get('input[type="radio"][value="interview"]').check()
          cy.contains('button', /^변경하기$/).click()
        })
    })

    cy.get('@failedCandidateId').then((candidateId) => {
      cy.document().then((document) => {
        const id = String(candidateId)

        expect(
          document.querySelector(
            `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
          ),
        ).to.equal(null)
        expect(
          document.querySelector(
            `${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
          ),
        ).not.to.equal(null)
      })
    })

    cy.get('[role="dialog"]:visible [role="alert"]')
      .should('be.visible')
      .and(
        'contain.text',
        '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
      )
      .and('not.contain.text', 'internal failure detail')
    cy.get('@failedCandidateId').then((candidateId) => {
      cy.get(
        `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('exist')
      cy.get(
        `${TARGET_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('not.exist')
    })
    cy.injectAxe()
    cy.checkA11y('[role="dialog"]')

    cy.get('[role="dialog"]:visible [role="alert"] button').click()

    cy.get('[role="dialog"]:visible [role="alert"]').should('not.exist')
    cy.get('@failedCandidateId').then((candidateId) => {
      cy.get(
        `${TARGET_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('exist')
      cy.get(
        `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('not.exist')
    })

    cy.get('[role="dialog"]:visible [data-candidate-detail-id]')
      .should('have.focus')
      .within(() => {
        cy.contains('dt', /^현재 단계$/)
          .next('dd')
          .should('have.text', '면접')
      })
    cy.injectAxe()
    cy.checkA11y('[role="dialog"]')
  })
})
