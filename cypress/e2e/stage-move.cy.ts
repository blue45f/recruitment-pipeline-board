import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'

const SOURCE_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-document_review"]'
const TARGET_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-interview"]'
const FINAL_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-offer_discussion"]'

type StagePatchBody = Readonly<{
  clientMutationId: string
  compensatesClientMutationId?: string
  expectedRevision: number
  stage: string
}>

type MovedCandidate = Readonly<{
  candidateId: string
  candidateName: string
}>

const BOARD_READY_MESSAGE = '전체 200명 중 200명을 표시합니다.'
const SAFE_SERVER_ERROR_MESSAGE =
  '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.'

function stagePatchBody(rawBody: unknown): StagePatchBody {
  expect(rawBody).to.be.an('object')

  return rawBody as StagePatchBody
}

function moveFirstDocumentReviewCandidateToInterview(): Cypress.Chainable<MovedCandidate> {
  let movedCandidate: MovedCandidate | undefined

  return cy
    .contains('[role="status"]', BOARD_READY_MESSAGE, { timeout: 5_000 })
    .should('be.visible')
    .then(() =>
      cy
        .get<HTMLButtonElement>(
          `${SOURCE_STAGE_SELECTOR} [data-stage-change-candidate-id]`,
        )
        .first()
        .should('be.visible'),
    )
    .then(($button) => {
      const candidateId = $button.attr('data-stage-change-candidate-id')
      const candidateName = $button.attr('aria-label')?.split(' 후보자 ')[0]

      expect(candidateId).to.be.a('string').and.not.equal('')
      expect(candidateName).to.be.a('string').and.not.equal('')

      movedCandidate = {
        candidateId: String(candidateId),
        candidateName: String(candidateName),
      }

      return cy.wrap($button).click()
    })
    .then(() => {
      cy.get('[role="dialog"] input[type="radio"][value="interview"]').check()

      return cy.contains('[role="dialog"] button', /^변경하기$/).click()
    })
    .then(() => {
      expect(movedCandidate).not.to.equal(undefined)

      return movedCandidate as MovedCandidate
    })
}

function getAvailableUndoAction(candidateName: string) {
  return cy
    .get('[data-undo-status="available"]', { timeout: 5_000 })
    .should('be.visible')
    .find<HTMLButtonElement>('button')
    .should(
      'have.attr',
      'aria-label',
      `${candidateName} 후보자를 서류검토 단계로 되돌리기`,
    )
}

function checkBodyA11y() {
  cy.checkA11y(
    'body',
    { interval: 100, retries: 5 },
    (violations) => {
      const details = violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.map((node) => ({
          failureSummary: node.failureSummary,
          html: node.html,
          target: node.target,
        })),
      }))

      expect(
        details,
        `axe violations: ${JSON.stringify(details)}`,
      ).to.deep.equal([])
    },
    true,
  )
}

type StagePatchControl = (
  body: StagePatchBody,
  controls: Readonly<{
    fetchResponse: (path: string) => Promise<Response>
    proceed: () => Promise<Response>
  }>,
) => Promise<Response>

function visitRecruitmentBoardWithStagePatchControl(
  control: StagePatchControl,
) {
  visitRecruitmentBoardWithStableMockApi({ storageMode: 'reset' })

  return cy
    .contains('[role="status"]', BOARD_READY_MESSAGE, { timeout: 5_000 })
    .should('be.visible')
    .then(() => cy.window())
    .then((window) => {
      const originalFetch = window.fetch.bind(window)

      Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          const observedRequest = new window.Request(input, init)
          const observedUrl = new URL(observedRequest.url)
          const isCandidateStagePatch =
            observedRequest.method === 'PATCH' &&
            /^\/api\/candidates\/[^/]+\/stage$/.test(observedUrl.pathname)

          if (!isCandidateStagePatch) return originalFetch(observedRequest)

          const body = stagePatchBody(await observedRequest.clone().json())

          return control(body, {
            fetchResponse: (path) =>
              originalFetch(new URL(path, window.location.origin)),
            proceed: () => originalFetch(observedRequest),
          })
        },
        writable: true,
      })
    })
}

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

        assert.isNull(
          document.querySelector(
            `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
          ),
        )
        assert.isNotNull(optimisticCard)
        expect(
          document
            .querySelector(`[data-stage-change-candidate-id="${id}"]`)
            ?.getAttribute('aria-busy'),
        ).to.equal('true')
        assert.isNull(document.querySelector('[role="dialog"]'))
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

        assert.isNull(
          document.querySelector(
            `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
          ),
        )
        assert.isNotNull(
          document.querySelector(
            `${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`,
          ),
        )
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

  it('저장 중에도 최신 목적 단계로 다시 이동하고 마지막 결과만 확정한다', () => {
    cy.viewport(1440, 900)
    let shouldGateFirstPatch = true
    let releaseFirstPatchResponse = () => undefined
    const firstPatchResponseGate = new Cypress.Promise<void>((resolve) => {
      releaseFirstPatchResponse = resolve
    })

    cy.intercept('PATCH', '**/api/candidates/*/stage', (request) => {
      if (!shouldGateFirstPatch) return

      shouldGateFirstPatch = false
      request.on('before:response', () => firstPatchResponseGate)
    })
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

        cy.wrap(candidateId).as('rapidMoveCandidateId')
        cy.wrap(candidateName).as('rapidMoveCandidateName')
        cy.wrap($button).click()
      })

    cy.get('[role="dialog"] input[type="radio"][value="interview"]').check()
    cy.contains('[role="dialog"] button', /^변경하기$/).click()

    cy.get('@rapidMoveCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get<HTMLButtonElement>(
        `${TARGET_STAGE_SELECTOR} [data-stage-change-candidate-id="${id}"]`,
      )
        .should('be.visible')
        .and('be.enabled')
        .and('have.attr', 'aria-busy', 'true')
        .click()
    })

    cy.get('[role="dialog"]').should('be.visible')
    cy.get('[role="dialog"] input[type="radio"][value="interview"]').should(
      'not.exist',
    )
    cy.get(
      '[role="dialog"] input[type="radio"][value="offer_discussion"]',
    ).check()
    cy.contains('[role="dialog"] button', /^변경하기$/).click()
    cy.then(() => releaseFirstPatchResponse())

    cy.get('@rapidMoveCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${FINAL_STAGE_SELECTOR} [data-stage-change-candidate-id="${id}"]`)
        .should('be.visible')
        .and('be.enabled')
        .and('have.attr', 'aria-busy', 'true')
      cy.get(
        `${TARGET_STAGE_SELECTOR} [data-stage-change-candidate-id="${id}"]`,
      ).should('not.exist')
    })

    cy.get('@rapidMoveCandidateName').then((candidateName) => {
      cy.contains(
        '[data-sonner-toast]',
        `${String(candidateName)} 후보자를 처우협의 단계로 이동했습니다.`,
        { timeout: 5_000 },
      ).should('be.visible')
      cy.contains(
        '[data-sonner-toast]',
        `${String(candidateName)} 후보자를 면접 단계로 이동했습니다.`,
      ).should('not.exist')
    })
    cy.get('@rapidMoveCandidateId').then((candidateId) => {
      cy.get(
        `${FINAL_STAGE_SELECTOR} [data-stage-change-candidate-id="${String(candidateId)}"]`,
      )
        .should('be.visible')
        .and('not.have.attr', 'aria-busy')
    })
    cy.injectAxe()
    cy.checkA11y('main')

    visitRecruitmentBoardWithStableMockApi({ storageMode: 'preserve' })

    cy.contains('[role="status"]', '전체 200명 중 200명을 표시합니다.', {
      timeout: 5_000,
    }).should('be.visible')
    cy.get('@rapidMoveCandidateId').then((candidateId) => {
      cy.get(
        `${FINAL_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('be.visible')
      cy.get(
        `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('not.exist')
      cy.get(
        `${TARGET_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('not.exist')
    })
  })

  it('성공 receipt로 노출한 Undo를 키보드로 보상하고 재방문 후에도 원 단계를 유지한다', () => {
    cy.viewport(1440, 900)
    let forwardBody: StagePatchBody | undefined
    let compensationBody: StagePatchBody | undefined
    let compensationRequestCount = 0
    let releaseCompensationResponse = () => undefined
    const compensationResponseGate = new Cypress.Promise<void>((resolve) => {
      releaseCompensationResponse = resolve
    })

    visitRecruitmentBoardWithStagePatchControl(async (body, { proceed }) => {
      if (body.compensatesClientMutationId === undefined) {
        forwardBody = body
        return proceed()
      }

      compensationBody = body
      compensationRequestCount += 1

      await compensationResponseGate

      return proceed()
    })

    moveFirstDocumentReviewCandidateToInterview().then(
      ({ candidateId, candidateName }) => {
        cy.wrap(candidateId).as('undoSuccessCandidateId')
        cy.wrap(candidateName).as('undoSuccessCandidateName')
      },
    )

    cy.injectAxe()
    checkBodyA11y()
    cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id]`).first().click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('[data-undo-status]').should('have.length', 1)
    cy.get('[role="dialog"] [data-undo-status="available"]').should(
      'be.visible',
    )
    cy.checkA11y('[role="dialog"]')
    cy.get('[role="dialog"] button[aria-label="닫기"]').click()
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('@undoSuccessCandidateName').then((candidateName) => {
      getAvailableUndoAction(String(candidateName)).focus().should('have.focus')
      cy.press(Cypress.Keyboard.Keys.SPACE)
    })

    cy.get('[data-undo-status="pending"]')
      .should('be.visible')
      .find('button')
      .should('be.disabled')
      .and('have.attr', 'aria-busy', 'true')
    cy.get('@undoSuccessCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'not.exist',
      )
    })
    cy.get('[data-undo-status="pending"]').should(() => {
      expect(forwardBody, 'forward PATCH body').not.to.equal(undefined)
      expect(compensationBody, 'compensation PATCH body').not.to.equal(
        undefined,
      )
      expect(compensationRequestCount, 'compensation PATCH count').to.equal(1)
      expect(compensationBody, 'compensation PATCH contract').to.include({
        compensatesClientMutationId: forwardBody?.clientMutationId,
        expectedRevision: (forwardBody?.expectedRevision ?? -1) + 1,
        stage: 'document_review',
      })
      expect(compensationBody?.clientMutationId).not.to.equal(
        forwardBody?.clientMutationId,
      )
    })
    checkBodyA11y()

    cy.then(() => releaseCompensationResponse())

    cy.get('[data-undo-status]').should('not.exist')
    cy.get('@undoSuccessCandidateName').then((candidateName) => {
      cy.contains(
        '[data-sonner-toast]',
        `${String(candidateName)} 후보자를 서류검토 단계로 되돌렸습니다.`,
        { timeout: 5_000 },
      ).should('be.visible')
    })
    cy.get('@undoSuccessCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'not.exist',
      )
    })
    cy.injectAxe()
    cy.checkA11y('main')

    visitRecruitmentBoardWithStableMockApi({ storageMode: 'preserve' })

    cy.contains('[role="status"]', BOARD_READY_MESSAGE, {
      timeout: 5_000,
    }).should('be.visible')
    cy.get('@undoSuccessCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'not.exist',
      )
    })
    cy.get('[data-undo-status]').should('not.exist')
  })

  it('Undo 보상이 일시 실패하면 확정 단계로 롤백한 뒤 안전하게 재시도한다', () => {
    cy.viewport(1440, 900)
    let compensationRequestCount = 0

    cy.intercept('GET', '**/__cypress__/undo-503', {
      body: {
        error: {
          code: 'SIMULATED_FAILURE',
          message: 'internal failure detail',
          requestId: 'cypress-undo-503',
          retryable: true,
        },
      },
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'cypress-undo-503',
      },
      statusCode: 503,
    })
    visitRecruitmentBoardWithStagePatchControl(
      async (body, { fetchResponse, proceed }) => {
        if (body.compensatesClientMutationId === undefined) return proceed()

        compensationRequestCount += 1

        return compensationRequestCount === 1
          ? fetchResponse('/__cypress__/undo-503')
          : proceed()
      },
    )

    moveFirstDocumentReviewCandidateToInterview().then(
      ({ candidateId, candidateName }) => {
        cy.wrap(candidateId).as('undoFailureCandidateId')
        getAvailableUndoAction(candidateName).click()
      },
    )

    cy.get('[data-undo-status="failure"][role="alert"]', {
      timeout: 5_000,
    })
      .should('be.visible')
      .and('contain.text', SAFE_SERVER_ERROR_MESSAGE)
      .and('not.contain.text', 'internal failure detail')
    cy.get('@undoFailureCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'not.exist',
      )
    })
    cy.injectAxe()
    checkBodyA11y()

    cy.get('[data-undo-status="failure"]')
      .find('button')
      .should('contain.text', '다시 시도')
      .click()

    cy.get('[data-undo-status]').should('not.exist')
    cy.get('@undoFailureCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'not.exist',
      )
    })
    cy.then(() => expect(compensationRequestCount).to.equal(2))
  })

  it('거의 동시에 Undo를 두 번 활성화해도 보상 요청은 한 번만 보낸다', () => {
    cy.viewport(1440, 900)
    let compensationRequestCount = 0
    let releaseCompensationResponse = () => undefined
    const compensationResponseGate = new Cypress.Promise<void>((resolve) => {
      releaseCompensationResponse = resolve
    })

    visitRecruitmentBoardWithStagePatchControl(async (body, { proceed }) => {
      if (body.compensatesClientMutationId === undefined) return proceed()

      compensationRequestCount += 1

      await compensationResponseGate

      return proceed()
    })

    moveFirstDocumentReviewCandidateToInterview().then(
      ({ candidateId, candidateName }) => {
        cy.wrap(candidateId).as('doubleUndoCandidateId')
        getAvailableUndoAction(candidateName).then(($button) => {
          const button = $button.get(0)

          expect(button).not.to.equal(undefined)
          button?.click()
          button?.click()
        })
      },
    )

    cy.get('[data-undo-status="pending"]').should('be.visible')
    cy.then(() => expect(compensationRequestCount).to.equal(1))
    cy.then(() => releaseCompensationResponse())

    cy.get('[data-undo-status]').should('not.exist')
    cy.get('@doubleUndoCandidateId').then((candidateId) => {
      cy.get(
        `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${String(candidateId)}"]`,
      ).should('exist')
    })
    cy.then(() => expect(compensationRequestCount).to.equal(1))
  })

  it('Undo receipt가 더 이상 유효하지 않으면 재베이스 요청 없이 최신 단계를 유지한다', () => {
    cy.viewport(1440, 900)
    const patchBodies: StagePatchBody[] = []

    cy.intercept('GET', '**/__cypress__/undo-409', {
      body: {
        error: {
          code: 'UNDO_NOT_AVAILABLE',
          message: 'internal stale receipt detail',
          requestId: 'cypress-undo-409',
          retryable: false,
        },
      },
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'cypress-undo-409',
      },
      statusCode: 409,
    })
    visitRecruitmentBoardWithStagePatchControl(
      async (body, { fetchResponse, proceed }) => {
        patchBodies.push(body)

        return body.compensatesClientMutationId === undefined
          ? proceed()
          : fetchResponse('/__cypress__/undo-409')
      },
    )

    moveFirstDocumentReviewCandidateToInterview().then(
      ({ candidateId, candidateName }) => {
        cy.wrap(candidateId).as('staleUndoCandidateId')
        cy.wrap(candidateName).as('staleUndoCandidateName')
        getAvailableUndoAction(candidateName).click()
      },
    )

    cy.get('@staleUndoCandidateName').then((candidateName) => {
      cy.contains(
        '[data-sonner-toast]',
        `${String(candidateName)} 후보자의 실행 취소를 완료하지 못했습니다. 면접 단계가 유지됩니다.`,
        { timeout: 5_000 },
      )
        .should('be.visible')
        .and('not.contain.text', 'internal stale receipt detail')
    })
    cy.get('@staleUndoCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'not.exist',
      )
    })
    cy.get('[data-undo-status]').should('not.exist')
    cy.then(() => {
      expect(patchBodies).to.have.length(2)
      expect(patchBodies[1]).to.include({
        compensatesClientMutationId: patchBodies[0]?.clientMutationId,
        expectedRevision: (patchBodies[0]?.expectedRevision ?? -1) + 1,
        stage: 'document_review',
      })
    })
  })

  it('Undo 결과를 알 수 없으면 재확인 상태와 잠긴 단계 변경을 안전하게 제공한다', () => {
    cy.viewport(1440, 900)
    let compensationRequestCount = 0

    visitRecruitmentBoardWithStagePatchControl(async (body, { proceed }) => {
      if (body.compensatesClientMutationId === undefined) return proceed()

      compensationRequestCount += 1
      throw new TypeError('Failed to fetch')
    })

    moveFirstDocumentReviewCandidateToInterview().then(
      ({ candidateId, candidateName }) => {
        cy.wrap(candidateId).as('unknownUndoCandidateId')
        cy.wrap(candidateName).as('unknownUndoCandidateName')
        getAvailableUndoAction(candidateName).click()
      },
    )

    cy.get('[data-undo-status="verification-required"][role="alert"]', {
      timeout: 5_000,
    })
      .should('be.visible')
      .and('contain.text', '되돌린 결과가 아직 확정되지 않았습니다.')
      .find('button')
      .should('be.enabled')
      .and('contain.text', '상태 다시 확인')
    cy.get('@unknownUndoCandidateId').then((candidateId) => {
      const id = String(candidateId)

      cy.get(`${SOURCE_STAGE_SELECTOR} [data-candidate-id="${id}"]`).should(
        'exist',
      )
      cy.get(`[data-stage-change-candidate-id="${id}"]`)
        .should('be.disabled')
        .and('not.have.attr', 'aria-busy')
    })
    cy.then(() => expect(compensationRequestCount).to.equal(2))
    cy.injectAxe()
    checkBodyA11y()
  })
})
