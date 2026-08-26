import { visitRecruitmentBoardWithStableMockApi } from '../support/visitRecruitmentBoard'
import {
  beginCandidatePointerGesture,
  cancelCandidatePointerDrag,
  cancelCandidatePointerSession,
  dragCandidateToStage,
  endCandidatePointerDrag,
  expectCandidatePointerDragActive,
  expectCandidatePointerDragInactive,
  expectNoCandidatePointerDragArtifacts,
  moveCandidatePointerOutsideBoard,
  moveCandidatePointerToStage,
  startCandidatePointerDrag,
} from '../support/candidatePointerDrag'
import {
  candidateStageUpdateRequestSchema,
  generateCandidateFixtures,
  type CandidateStageUpdateRequest,
  type CandidateStage,
} from '../../src/domains/recruitment/candidates/model'

const SOURCE_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-document_review"]'
const TARGET_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-interview"]'
const FINAL_STAGE_SELECTOR =
  'section[aria-labelledby="candidate-stage-offer_discussion"]'

type StagePatchBody = CandidateStageUpdateRequest

type MovedCandidate = Readonly<{
  candidateId: string
  candidateName: string
}>

const BOARD_READY_MESSAGE = '전체 200명 중 200명을 표시합니다.'
const SAFE_SERVER_ERROR_MESSAGE =
  '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.'
const stableCandidates = generateCandidateFixtures({
  seed: 20260826,
  size: 200,
})
const candidateNameCount = new Map<string, number>()

for (const candidate of stableCandidates) {
  candidateNameCount.set(
    candidate.name,
    (candidateNameCount.get(candidate.name) ?? 0) + 1,
  )
}

const emptyStageDropCandidate = stableCandidates.find(
  (candidate) =>
    candidate.currentStage === 'document_review' &&
    candidateNameCount.get(candidate.name) === 1,
)

if (emptyStageDropCandidate === undefined) {
  throw new Error('빈 단계 드롭을 검증할 고유 후보자를 찾지 못했습니다.')
}

function stagePatchBody(rawBody: unknown): StagePatchBody {
  return candidateStageUpdateRequestSchema.parse(rawBody)
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
      assert.isDefined(movedCandidate)

      return movedCandidate as MovedCandidate
    })
}

function dragFirstDocumentReviewCandidateTo(
  targetStage: CandidateStage,
  targetState: 'current' | 'valid' = 'valid',
): Cypress.Chainable<MovedCandidate> {
  return getFirstDocumentReviewDragCandidate().then((movedCandidate) =>
    dragCandidateToStage(
      movedCandidate.candidateId,
      targetStage,
      targetState,
    ).then(() => movedCandidate),
  )
}

function getFirstDocumentReviewDragCandidate(): Cypress.Chainable<MovedCandidate> {
  return cy
    .contains('[role="status"]', BOARD_READY_MESSAGE, { timeout: 5_000 })
    .should('be.visible')
    .then(() =>
      cy
        .get<HTMLButtonElement>(
          `${SOURCE_STAGE_SELECTOR} [data-candidate-drag-handle]`,
        )
        .first()
        .should('be.visible'),
    )
    .then(($handle) => {
      const candidateId = $handle.attr('data-candidate-drag-handle')
      const candidateName = $handle.attr('aria-label')?.split(' 후보자 ')[0]

      expect(candidateId).to.be.a('string').and.not.equal('')
      expect(candidateName).to.be.a('string').and.not.equal('')

      return {
        candidateId: String(candidateId),
        candidateName: String(candidateName),
      }
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

function emulateReducedMotion(enabled: boolean) {
  if (Cypress.browser.family !== 'chromium') return cy.wrap(undefined)

  return cy.then(() =>
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setEmulatedMedia',
      params: {
        features: enabled
          ? [{ name: 'prefers-reduced-motion', value: 'reduce' }]
          : [],
      },
    }),
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
  visitRecruitmentBoardWithStableMockApi({
    storageMode: 'reset',
    stubPointerCapture: true,
  })

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
  let shouldResetReducedMotion = false

  afterEach(() => {
    if (!shouldResetReducedMotion) return

    shouldResetReducedMotion = false
    emulateReducedMotion(false)
  })

  it('현재 단계·보드 밖 드롭과 Escape 취소는 저장이나 Undo를 만들지 않는다', () => {
    cy.viewport(1440, 900)
    let patchRequestCount = 0

    visitRecruitmentBoardWithStagePatchControl(async (_body, { proceed }) => {
      patchRequestCount += 1

      return proceed()
    })

    dragFirstDocumentReviewCandidateTo('document_review', 'current').then(
      ({ candidateId }) => {
        cy.get(
          `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${candidateId}"]`,
        ).should('be.visible')
        cy.get(
          `${TARGET_STAGE_SELECTOR} [data-candidate-id="${candidateId}"]`,
        ).should('not.exist')

        startCandidatePointerDrag(candidateId)
          .then(moveCandidatePointerOutsideBoard)
          .then(endCandidatePointerDrag)
          .then(() => startCandidatePointerDrag(candidateId))
          .then((session) => moveCandidatePointerToStage(session, 'interview'))
          .then(() => {
            cy.injectAxe()
            checkBodyA11y()

            return cancelCandidatePointerDrag()
          })
      },
    )
    cy.get('[data-candidate-drag-overlay]').should('not.exist')
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('[data-undo-status]').should('not.exist')
    cy.then(() => expect(patchRequestCount).to.equal(0))
  })

  it('작은 포인터 이동과 취소된 터치 제스처는 드래그나 저장으로 이어지지 않는다', () => {
    cy.viewport(1440, 900)
    let patchRequestCount = 0
    let restorePointerTimers: () => void = () => undefined

    visitRecruitmentBoardWithStagePatchControl(async (_body, { proceed }) => {
      patchRequestCount += 1

      return proceed()
    })

    getFirstDocumentReviewDragCandidate().then(({ candidateId }) =>
      cy
        .get(`[data-candidate-drag-handle="${candidateId}"]`)
        .should('have.css', 'touch-action', 'pan-y')
        .then(() =>
          beginCandidatePointerGesture(candidateId, {
            activationDistancePx: 8,
          }),
        )
        .then(expectCandidatePointerDragInactive)
        .then(cancelCandidatePointerSession)
        .then(() => cy.clock(0, ['setTimeout', 'clearTimeout']))
        .then((clock) => {
          restorePointerTimers = () => clock.restore()

          return beginCandidatePointerGesture(candidateId, {
            pointerType: 'touch',
          })
        })
        .then((session) => {
          cy.tick(249)

          return expectCandidatePointerDragInactive(session)
        })
        .then((session) => {
          cy.tick(1)

          return expectCandidatePointerDragActive(session)
        })
        .then((session) => {
          restorePointerTimers()

          return session
        })
        .then((session) => moveCandidatePointerToStage(session, 'interview'))
        .then(cancelCandidatePointerSession)
        .then(() => cy.clock(0, ['setTimeout', 'clearTimeout']))
        .then((clock) => {
          restorePointerTimers = () => clock.restore()

          return beginCandidatePointerGesture(candidateId, {
            activationDistancePx: 9,
            pointerType: 'touch',
          })
        })
        .then((session) => {
          cy.tick(250)

          return expectCandidatePointerDragInactive(session)
        })
        .then((session) => {
          restorePointerTimers()

          return cancelCandidatePointerSession(session)
        }),
    )

    cy.get('[data-candidate-drag-overlay]').should('not.exist')
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('[data-undo-status]').should('not.exist')
    cy.then(() => expect(patchRequestCount).to.equal(0))
  })

  it('드래그로 저장한 이동도 같은 receipt로 되돌린다', () => {
    cy.viewport(1440, 900)
    let forwardBody: StagePatchBody | undefined
    let compensationBody: StagePatchBody | undefined

    visitRecruitmentBoardWithStagePatchControl(async (body, { proceed }) => {
      if (body.compensatesClientMutationId === undefined) {
        forwardBody = body
      } else {
        compensationBody = body
      }

      return proceed()
    })

    dragFirstDocumentReviewCandidateTo('interview').then(
      ({ candidateId, candidateName }) => {
        cy.get(
          `${TARGET_STAGE_SELECTOR} [data-candidate-id="${candidateId}"]`,
        ).should('be.visible')
        cy.get(
          `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${candidateId}"]`,
        ).should('not.exist')
        cy.get('[role="dialog"]').should('not.exist')
        getAvailableUndoAction(candidateName).click()

        cy.contains(
          '[data-sonner-toast]',
          `${candidateName} 후보자를 서류검토 단계로 되돌렸습니다.`,
          { timeout: 5_000 },
        ).should('be.visible')
        cy.get(
          `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${candidateId}"]`,
        ).should('be.visible')
        cy.get(
          `${TARGET_STAGE_SELECTOR} [data-candidate-id="${candidateId}"]`,
        ).should('not.exist')
      },
    )
    cy.then(() => {
      assert.isDefined(forwardBody, 'drag forward PATCH body')
      assert.isDefined(compensationBody, 'drag compensation PATCH body')
      expect(forwardBody).to.include({ stage: 'interview' })
      assert.isUndefined(
        forwardBody?.compensatesClientMutationId,
        'drag forward request is not a compensation',
      )
      expect(compensationBody).to.include({
        compensatesClientMutationId: forwardBody?.clientMutationId,
        expectedRevision: (forwardBody?.expectedRevision ?? -1) + 1,
        stage: 'document_review',
      })
      expect(compensationBody?.clientMutationId).not.to.equal(
        forwardBody?.clientMutationId,
      )
    })
    cy.injectAxe()
    checkBodyA11y()
  })

  it('동작 줄이기 환경에서는 드래그 피드백의 움직임을 제거한다', function () {
    if (Cypress.browser.family !== 'chromium') this.skip()

    cy.viewport(1440, 900)
    shouldResetReducedMotion = true
    emulateReducedMotion(true)
    visitRecruitmentBoardWithStableMockApi({
      storageMode: 'reset',
      stubPointerCapture: true,
    })

    getFirstDocumentReviewDragCandidate()
      .then(({ candidateId }) => startCandidatePointerDrag(candidateId))
      .then((session) => moveCandidatePointerToStage(session, 'interview'))
      .then(() => {
        cy.get<HTMLElement>('[data-candidate-drag-overlay]').should(
          ($overlay) => {
            const style = getComputedStyle($overlay.get(0))

            expect(['none', '0deg'], 'drag overlay rotation').to.include(
              style.rotate,
            )
          },
        )
        cy.get<HTMLElement>('[data-candidate-dragging="true"]').should(
          ($candidate) => {
            expect(
              getComputedStyle($candidate.get(0)).transitionProperty,
              'drag source transition property',
            ).to.equal('none')
          },
        )
        cy.get<HTMLElement>('[data-candidate-stage-drop-active="true"]').should(
          ($stage) => {
            expect(
              getComputedStyle($stage.get(0)).transitionProperty,
              'drop target transition property',
            ).to.equal('none')
          },
        )

        return cancelCandidatePointerDrag()
      })
  })

  it('검색으로 비어 있는 단계에도 후보자를 놓아 저장한다', () => {
    cy.viewport(1440, 900)
    const patchBodies: StagePatchBody[] = []

    visitRecruitmentBoardWithStagePatchControl(async (body, { proceed }) => {
      patchBodies.push(body)

      return proceed()
    })

    cy.get('[role="search"] input[type="search"]').type(
      emptyStageDropCandidate.name,
    )
    cy.contains('[role="status"]', '전체 200명 중 1명을 표시합니다.', {
      timeout: 5_000,
    }).should('be.visible')
    cy.get(`${TARGET_STAGE_SELECTOR} [data-candidate-id]`).should('not.exist')
    cy.contains(TARGET_STAGE_SELECTOR, '이 단계에 후보자가 없습니다.').should(
      'be.visible',
    )

    dragCandidateToStage(emptyStageDropCandidate.id, 'interview')

    cy.get(
      `${TARGET_STAGE_SELECTOR} [data-candidate-id="${emptyStageDropCandidate.id}"]`,
    ).should('be.visible')
    cy.get(
      `${SOURCE_STAGE_SELECTOR} [data-candidate-id="${emptyStageDropCandidate.id}"]`,
    ).should('not.exist')
    getAvailableUndoAction(emptyStageDropCandidate.name)

    cy.then(() => {
      expect(patchBodies).to.have.length(1)
      expect(patchBodies[0]).to.include({ stage: 'interview' })
      assert.isUndefined(
        patchBodies[0]?.compensatesClientMutationId,
        'empty-stage drag request is not a compensation',
      )
    })
  })

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
    let releaseFirstPatchResponse: () => void = () => undefined
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
    let releaseCompensationResponse: () => void = () => undefined
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
      assert.isDefined(forwardBody, 'forward PATCH body')
      assert.isDefined(compensationBody, 'compensation PATCH body')
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
    let markCompensationRequestObserved: () => void = () => undefined
    let releaseCompensationResponse: () => void = () => undefined
    const compensationRequestObserved = new Cypress.Promise<void>((resolve) => {
      markCompensationRequestObserved = resolve
    })
    const compensationResponseGate = new Cypress.Promise<void>((resolve) => {
      releaseCompensationResponse = resolve
    })

    visitRecruitmentBoardWithStagePatchControl(async (body, { proceed }) => {
      if (body.compensatesClientMutationId === undefined) return proceed()

      compensationRequestCount += 1
      markCompensationRequestObserved()

      await compensationResponseGate

      return proceed()
    })

    moveFirstDocumentReviewCandidateToInterview().then(
      ({ candidateId, candidateName }) => {
        cy.wrap(candidateId).as('doubleUndoCandidateId')
        getAvailableUndoAction(candidateName).then(($button) => {
          const button = $button.get(0)

          assert.isDefined(button)
          button.click()
          button.click()
        })
      },
    )

    cy.get('[data-undo-status="pending"]').should('be.visible')
    cy.wrap(compensationRequestObserved)
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
        '[data-sonner-toast][data-type="error"][data-mounted="true"][data-visible="true"][data-removed="false"]',
        `${String(candidateName)} 후보자의 실행 취소를 완료하지 못했습니다. 면접 단계가 유지됩니다.`,
        { timeout: 7_000 },
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
      const handleSelector = `[data-stage-change-candidate-id="${id}"]`

      cy.get(handleSelector).should('be.disabled')
      cy.get(handleSelector).should('not.have.attr', 'aria-busy')
      cy.get<HTMLButtonElement>(handleSelector).then(($handle) => {
        const bounds = $handle.get(0).getBoundingClientRect()
        const pointerId = 404
        const initialPoint = {
          clientX: Math.round(bounds.left + bounds.width / 2),
          clientY: Math.round(bounds.top + bounds.height / 2),
        }
        const pointerOptions = {
          bubbles: true,
          button: 0,
          cancelable: true,
          eventConstructor: 'PointerEvent',
          force: true,
          isPrimary: true,
          pointerId,
          pointerType: 'mouse',
        } as const

        cy.wrap($handle).trigger('pointerdown', {
          ...pointerOptions,
          ...initialPoint,
          buttons: 1,
        })
        cy.get('body').trigger('pointermove', {
          ...pointerOptions,
          buttons: 1,
          clientX: initialPoint.clientX + 12,
          clientY: initialPoint.clientY,
        })
        expectNoCandidatePointerDragArtifacts()
        cy.get('body').trigger('pointerup', {
          ...pointerOptions,
          ...initialPoint,
          buttons: 0,
        })
      })
    })
    expectNoCandidatePointerDragArtifacts()
    cy.then(() => expect(compensationRequestCount).to.equal(2))
    cy.injectAxe()
    checkBodyA11y()
  })
})
