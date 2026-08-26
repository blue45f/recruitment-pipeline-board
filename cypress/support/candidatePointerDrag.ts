import type { CandidateStage } from '../../src/domains/recruitment/candidates/model'

type PointerPoint = Readonly<{
  clientX: number
  clientY: number
}>

export type CandidatePointerDragSession = Readonly<{
  candidateId: string
  pointerId: number
  pointerType: 'mouse' | 'pen' | 'touch'
  point: PointerPoint
}>

type CandidatePointerGestureOptions = Readonly<{
  activationDistancePx?: number
  pointerType?: CandidatePointerDragSession['pointerType']
}>

let pointerIdSequence = 10

function centerPoint(element: Element): PointerPoint {
  const bounds = element.getBoundingClientRect()

  expect(bounds.width, 'pointer target width').to.be.greaterThan(0)
  expect(bounds.height, 'pointer target height').to.be.greaterThan(0)

  return {
    clientX: Math.round(bounds.left + bounds.width / 2),
    clientY: Math.round(bounds.top + bounds.height / 2),
  }
}

function pointerTriggerOptions(
  session: CandidatePointerDragSession,
  buttons: 0 | 1,
) {
  return {
    bubbles: true,
    button: 0,
    buttons,
    cancelable: true,
    clientX: session.point.clientX,
    clientY: session.point.clientY,
    eventConstructor: 'PointerEvent',
    force: true,
    isPrimary: true,
    pointerId: session.pointerId,
    pointerType: session.pointerType,
  } as const
}

function triggerGlobalPointer(
  type: 'pointermove' | 'pointerup',
  session: CandidatePointerDragSession,
  buttons: 0 | 1,
) {
  return cy.get('body').trigger(type, pointerTriggerOptions(session, buttons))
}

function triggerDocumentPointerCancel(session: CandidatePointerDragSession) {
  return cy.document().then((document) => {
    const view = document.defaultView

    if (view === null) {
      throw new Error('pointercancel을 보낼 브라우저 창을 찾지 못했습니다.')
    }

    document.dispatchEvent(
      new view.PointerEvent('pointercancel', {
        bubbles: true,
        button: 0,
        buttons: 0,
        cancelable: true,
        clientX: session.point.clientX,
        clientY: session.point.clientY,
        isPrimary: true,
        pointerId: session.pointerId,
        pointerType: session.pointerType,
      }),
    )
  })
}

export function beginCandidatePointerGesture(
  candidateId: string,
  {
    activationDistancePx = 0,
    pointerType = 'mouse',
  }: CandidatePointerGestureOptions = {},
): Cypress.Chainable<CandidatePointerDragSession> {
  const pointerId = ++pointerIdSequence

  return cy
    .get<HTMLButtonElement>(`[data-candidate-drag-handle="${candidateId}"]`)
    .should('be.visible')
    .and('be.enabled')
    .then(($handle) => {
      const initialSession: CandidatePointerDragSession = {
        candidateId,
        pointerId,
        pointerType,
        point: centerPoint($handle.get(0)),
      }
      const activatedSession: CandidatePointerDragSession = {
        ...initialSession,
        point: {
          clientX: initialSession.point.clientX + activationDistancePx,
          clientY: initialSession.point.clientY,
        },
      }

      cy.wrap($handle).trigger(
        'pointerdown',
        pointerTriggerOptions(initialSession, 1),
      )

      return triggerGlobalPointer('pointermove', activatedSession, 1).then(
        () => activatedSession,
      )
    })
}

export function expectCandidatePointerDragInactive(
  session: CandidatePointerDragSession,
): Cypress.Chainable<CandidatePointerDragSession> {
  return cy
    .get('[data-candidate-drag-overlay]')
    .should('not.exist')
    .then(() =>
      cy
        .get(
          '[data-candidate-stage-drop-active="true"], [data-candidate-stage-drop-current="true"]',
        )
        .should('not.exist'),
    )
    .then(() => session)
}

export function expectCandidatePointerDragActive(
  session: CandidatePointerDragSession,
): Cypress.Chainable<CandidatePointerDragSession> {
  return cy
    .get(`[data-candidate-drag-handle="${session.candidateId}"]`)
    .closest('[data-candidate-dragging="true"]')
    .should('exist')
    .then(() => session)
    .then((session) =>
      cy
        .get('[data-candidate-drag-overlay]')
        .should('exist')
        .then(() => session),
    )
    .then((session) =>
      cy
        .get('[data-dnd-overlay]')
        .should('have.css', 'z-index', '1000')
        .then(() => session),
    )
}

export function startCandidatePointerDrag(
  candidateId: string,
): Cypress.Chainable<CandidatePointerDragSession> {
  return beginCandidatePointerGesture(candidateId, {
    activationDistancePx: 12,
  }).then(expectCandidatePointerDragActive)
}

export function moveCandidatePointerToStage(
  session: CandidatePointerDragSession,
  stage: CandidateStage,
  targetState: 'current' | 'valid' = 'valid',
): Cypress.Chainable<CandidatePointerDragSession> {
  const zoneSelector = `[data-candidate-stage-drop-zone="${stage}"]`

  return cy
    .get<HTMLElement>(`${zoneSelector} h2`)
    .should('be.visible')
    .then(($heading) => {
      const movedSession = {
        ...session,
        point: centerPoint($heading.get(0)),
      }

      return triggerGlobalPointer('pointermove', movedSession, 1).then(
        () => movedSession,
      )
    })
    .then((movedSession) => {
      const targetStateAttribute =
        targetState === 'valid'
          ? 'data-candidate-stage-drop-active'
          : 'data-candidate-stage-drop-current'

      return cy
        .get(zoneSelector)
        .should('have.attr', targetStateAttribute, 'true')
        .then(() => movedSession)
    })
}

export function moveCandidatePointerOutsideBoard(
  session: CandidatePointerDragSession,
): Cypress.Chainable<CandidatePointerDragSession> {
  return cy
    .get<HTMLElement>('main h1')
    .first()
    .should('be.visible')
    .then(($heading) => {
      const movedSession = {
        ...session,
        point: centerPoint($heading.get(0)),
      }

      return triggerGlobalPointer('pointermove', movedSession, 1).then(
        () => movedSession,
      )
    })
    .then((movedSession) =>
      cy
        .get(
          '[data-candidate-stage-drop-active="true"], [data-candidate-stage-drop-current="true"]',
        )
        .should('not.exist')
        .then(() => movedSession),
    )
}

export function endCandidatePointerDrag(session: CandidatePointerDragSession) {
  return triggerGlobalPointer('pointerup', session, 0)
    .then(() => cy.get('[data-candidate-drag-overlay]').should('not.exist'))
    .then(() =>
      cy
        .get(
          '[data-candidate-stage-drop-active="true"], [data-candidate-stage-drop-current="true"]',
        )
        .should('not.exist'),
    )
    .then(() => undefined)
}

export function cancelCandidatePointerSession(
  session: CandidatePointerDragSession,
) {
  return triggerDocumentPointerCancel(session)
    .then(() => expectCandidatePointerDragInactive(session))
    .then(() => undefined)
}

export function cancelCandidatePointerDrag() {
  cy.get('body').trigger('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Escape',
    eventConstructor: 'KeyboardEvent',
    force: true,
    key: 'Escape',
  })

  return cy
    .get('[data-candidate-drag-overlay]')
    .should('not.exist')
    .then(() =>
      cy
        .get(
          '[data-candidate-stage-drop-active="true"], [data-candidate-stage-drop-current="true"]',
        )
        .should('not.exist'),
    )
    .then(() => undefined)
}

export function dragCandidateToStage(
  candidateId: string,
  stage: CandidateStage,
  targetState: 'current' | 'valid' = 'valid',
) {
  return startCandidatePointerDrag(candidateId)
    .then((session) => moveCandidatePointerToStage(session, stage, targetState))
    .then(endCandidatePointerDrag)
}
