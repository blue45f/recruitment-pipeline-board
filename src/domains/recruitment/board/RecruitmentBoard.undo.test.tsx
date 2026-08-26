import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  createCandidateHandlers,
  createCandidateMockRepository,
  createMemoryCandidateMockStorage,
  type CandidateMockRepository,
  type CandidateMockStorage,
} from '@/domains/recruitment/candidates/api/mock'
import {
  CANDIDATE_STAGES,
  CANDIDATE_STAGE_LABELS,
  candidateStageUpdateRequestSchema,
  candidateStageUpdateResponseSchema,
  type Candidate,
  type CandidateStage,
  type CandidateStageUpdateRequest,
} from '@/domains/recruitment/candidates/model'
import { server } from '@/mocks/server'
import { installVirtualizedListDomMocks } from '@/test/installVirtualizedListDomMocks'

import { useBoardDetailStore, useBoardPreferencesStore } from './model'
import { CandidateMovementProvider } from './movement'
import { RecruitmentBoard } from './RecruitmentBoard'

const SAFE_UNDO_FAILURE_MESSAGE =
  '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.'

let restoreVirtualizedListDom: (() => void) | undefined

type Deferred = Readonly<{
  promise: Promise<void>
  resolve: () => void
}>

type StagePatchStep = Readonly<{
  gate?: Deferred
  outcome?: 'failure' | 'network-error' | 'success'
}>

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve() {
      resolvePromise?.()
    },
  }
}

function renderBoard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 30_000 },
    },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CandidateMovementProvider>
        <MemoryRouter>
          <RecruitmentBoard />
          <Toaster position="bottom-center" />
        </MemoryRouter>
      </CandidateMovementProvider>
    </QueryClientProvider>,
  )

  return { ...view, queryClient }
}

function installRepositoryHandlers(repository: CandidateMockRepository) {
  let requestSequence = 0

  server.use(
    ...createCandidateHandlers({
      createRequestId: () => `undo-board-request-${++requestSequence}`,
      latency: () => 0,
      now: () => new Date('2026-08-27T12:00:00.000Z'),
      repository,
      shouldFail: () => false,
      wait: async () => undefined,
    }),
  )
}

function installStagePatchSequence(
  repository: CandidateMockRepository,
  steps: readonly StagePatchStep[],
) {
  const requests: CandidateStageUpdateRequest[] = []

  server.use(
    http.patch(
      '*/api/candidates/:candidateId/stage',
      async ({ params, request }) => {
        const body = candidateStageUpdateRequestSchema.parse(
          await request.json(),
        )
        const requestIndex = requests.push(body) - 1
        const requestId = `undo-patch-${requestIndex + 1}`
        const step = steps[requestIndex] ?? { outcome: 'success' }

        await step.gate?.promise

        if (step.outcome === 'network-error') {
          return HttpResponse.error()
        }

        if (step.outcome === 'failure') {
          return HttpResponse.json(
            {
              error: {
                code: 'SIMULATED_FAILURE',
                message: SAFE_UNDO_FAILURE_MESSAGE,
                requestId,
                retryable: true,
              },
            },
            {
              headers: { 'x-request-id': requestId },
              status: 503,
            },
          )
        }

        const operationTime = new Date(
          Date.parse('2026-08-27T12:00:00.000Z') + requestIndex * 60_000,
        ).toISOString()
        const result = repository.commitStage({
          candidateId: String(params.candidateId),
          clientMutationId: body.clientMutationId,
          ...(body.compensatesClientMutationId === undefined
            ? {}
            : {
                compensatesClientMutationId: body.compensatesClientMutationId,
              }),
          committedAt: operationTime,
          currentStage: body.stage,
          expectedRevision: body.expectedRevision,
          requestId,
          stageChangedAt: operationTime,
        })

        if (result.status !== 'updated' && result.status !== 'replayed') {
          throw new Error(`단계 이동을 확정하지 못했습니다: ${result.status}`)
        }

        const receipt = result.receipt
        const undoReceipt =
          receipt.operationKind === 'move'
            ? {
                candidateId: receipt.candidateId,
                clientMutationId: receipt.clientMutationId,
                committedRevision: receipt.candidate.revision,
                currentStage: receipt.currentStage,
                expectedRevision: receipt.expectedRevision,
                previousStage: receipt.previousStage,
              }
            : undefined
        const response = candidateStageUpdateResponseSchema.parse({
          data: result.candidate,
          meta: {
            clientMutationId: receipt.clientMutationId,
            requestId: receipt.requestId,
            ...(undoReceipt === undefined ? {} : { undoReceipt }),
          },
        })

        return HttpResponse.json(response, {
          headers: { 'x-request-id': requestId },
        })
      },
    ),
  )

  return requests
}

function getFirstCandidate(repository: CandidateMockRepository) {
  const candidate = repository.list(200)[0]

  if (!candidate) {
    throw new Error('실행 취소 테스트 후보자를 생성하지 못했습니다.')
  }

  return candidate
}

function findDifferentStage(currentStage: CandidateStage) {
  const stage = CANDIDATE_STAGES.find(
    (candidateStage) => candidateStage !== currentStage,
  )

  if (!stage) {
    throw new Error('이동할 후보자 단계를 찾지 못했습니다.')
  }

  return stage
}

function getStageSection(stage: CandidateStage) {
  return screen.getByRole('region', {
    hidden: true,
    name: CANDIDATE_STAGE_LABELS[stage],
  })
}

function expectCandidateInStage(candidate: Candidate, stage: CandidateStage) {
  expect(
    within(getStageSection(stage)).getByRole('button', {
      hidden: true,
      name: new RegExp(`^${candidate.name} .*후보자 상세 보기$`),
    }),
  ).toBeInTheDocument()
}

function availableUndoName(candidate: Candidate) {
  return `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[candidate.currentStage]} 단계로 되돌리기`
}

async function submitStageMove(
  user: ReturnType<typeof userEvent.setup>,
  candidate: Candidate,
  targetStage: CandidateStage,
) {
  await user.click(
    await screen.findByRole('button', {
      name: `${candidate.name} 후보자 드래그 · 단계 변경`,
    }),
  )

  const dialog = await screen.findByRole('dialog', {
    name: `${candidate.name} 후보자 단계 변경`,
  })

  await user.click(
    within(dialog).getByRole('radio', {
      name: CANDIDATE_STAGE_LABELS[targetStage],
    }),
  )
  await user.click(within(dialog).getByRole('button', { name: '변경하기' }))

  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', {
        name: `${candidate.name} 후보자 단계 변경`,
      }),
    ).not.toBeInTheDocument()
  })
}

beforeAll(() => {
  restoreVirtualizedListDom = installVirtualizedListDomMocks()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})

beforeEach(() => {
  localStorage.clear()
  useBoardDetailStore.setState({ selectedCandidateId: null })
  useBoardPreferencesStore.setState({ listSize: 200 })
})

afterEach(() => {
  useBoardDetailStore.setState({ selectedCandidateId: null })
  useBoardPreferencesStore.setState({ listSize: 200 })
  localStorage.clear()
})

afterAll(() => {
  restoreVirtualizedListDom?.()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

describe('RecruitmentBoard candidate stage move Undo', () => {
  it('서버 성공 receipt 후에만 노출하고 보상 성공 전후를 낙관적으로 투영한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const forwardGate = createDeferred()
    const undoGate = createDeferred()

    installRepositoryHandlers(repository)
    const requests = installStagePatchSequence(repository, [
      { gate: forwardGate },
      { gate: undoGate },
    ])
    renderBoard()

    await submitStageMove(user, candidate, targetStage)

    expectCandidateInStage(candidate, targetStage)
    expect(repository.getById(candidate.id)).toEqual(candidate)
    expect(
      screen.queryByRole('button', { name: availableUndoName(candidate) }),
    ).not.toBeInTheDocument()
    expect(requests).toHaveLength(1)

    forwardGate.resolve()

    const undoButton = await screen.findByRole('button', {
      name: availableUndoName(candidate),
    })

    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })
    await user.click(undoButton)

    await waitFor(() =>
      expectCandidateInStage(candidate, candidate.currentStage),
    )
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({
      compensatesClientMutationId: requests[0]?.clientMutationId,
      expectedRevision: candidate.revision + 1,
      stage: candidate.currentStage,
    })

    undoGate.resolve()

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: availableUndoName(candidate) }),
      ).not.toBeInTheDocument()
    })
    expectCandidateInStage(candidate, candidate.currentStage)
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: candidate.currentStage,
      revision: candidate.revision + 2,
    })
  })

  it('보상 실패 시 확정 단계로 롤백하고 안전한 재시도로 완료한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const failureGate = createDeferred()
    const retryGate = createDeferred()

    installRepositoryHandlers(repository)
    installStagePatchSequence(repository, [
      { outcome: 'success' },
      { gate: failureGate, outcome: 'failure' },
      { gate: retryGate, outcome: 'success' },
    ])
    renderBoard()

    await submitStageMove(user, candidate, targetStage)
    await user.click(
      await screen.findByRole('button', {
        name: availableUndoName(candidate),
      }),
    )

    await waitFor(() =>
      expectCandidateInStage(candidate, candidate.currentStage),
    )
    failureGate.resolve()

    const boardRegion = screen.getByRole('region', {
      name: '채용 단계별 후보자',
    })
    const alert = await within(boardRegion).findByRole('alert')

    expect(alert).toHaveTextContent(SAFE_UNDO_FAILURE_MESSAGE)
    expect(alert).not.toHaveTextContent('SIMULATED_FAILURE')
    expectCandidateInStage(candidate, targetStage)
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })

    await user.click(
      within(alert).getByRole('button', {
        name: `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[candidate.currentStage]} 단계로 되돌리기 다시 시도`,
      }),
    )

    await waitFor(() =>
      expectCandidateInStage(candidate, candidate.currentStage),
    )
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })

    retryGate.resolve()

    await waitFor(() => {
      expect(within(boardRegion).queryByRole('alert')).not.toBeInTheDocument()
    })
    expectCandidateInStage(candidate, candidate.currentStage)
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: candidate.currentStage,
      revision: candidate.revision + 2,
    })
  })

  it('상세 모달 안에만 하나의 실행 취소를 두고 키보드 완료 후 상세 내용으로 포커스를 돌려보낸다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const undoGate = createDeferred()

    installRepositoryHandlers(repository)
    installStagePatchSequence(repository, [
      { outcome: 'success' },
      { gate: undoGate, outcome: 'success' },
    ])
    renderBoard()

    await submitStageMove(user, candidate, targetStage)
    await screen.findByRole('button', { name: availableUndoName(candidate) })
    await user.click(
      within(getStageSection(targetStage)).getByRole('button', {
        name: new RegExp(`^${candidate.name} .*후보자 상세 보기$`),
      }),
    )

    const detailDialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 상세`,
    })

    await within(detailDialog).findByRole('region', {
      name: `${candidate.name} 후보자 상세 정보`,
    })

    const undoActions = screen.getAllByRole('button', {
      hidden: true,
      name: availableUndoName(candidate),
    })

    expect(undoActions).toHaveLength(1)
    expect(detailDialog).toContainElement(undoActions[0] ?? null)

    const undoButton = within(detailDialog).getByRole('button', {
      name: availableUndoName(candidate),
    })

    undoButton.focus()
    expect(undoButton).toHaveFocus()
    await user.keyboard('{Enter}')

    const detailContent = within(detailDialog).getByRole('region', {
      name: `${candidate.name} 후보자 상세 내용`,
    })

    await waitFor(() =>
      expectCandidateInStage(candidate, candidate.currentStage),
    )
    expect(detailContent).not.toHaveFocus()

    undoGate.resolve()

    await waitFor(() => {
      expect(detailContent).toHaveFocus()
    })
    expect(
      within(detailDialog).queryByRole('button', {
        name: availableUndoName(candidate),
      }),
    ).not.toBeInTheDocument()
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: candidate.currentStage,
      revision: candidate.revision + 2,
    })
  })

  it('다른 후보자 상세가 열려 있어도 전역 Undo 실패와 재시도 동작을 모달 안에서 제공한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const [movedCandidate, viewedCandidate] = repository.list(200)
    const failureGate = createDeferred()

    if (!movedCandidate || !viewedCandidate) {
      throw new Error('전역 실행 취소 테스트 후보자를 생성하지 못했습니다.')
    }

    const targetStage = findDifferentStage(movedCandidate.currentStage)

    installRepositoryHandlers(repository)
    installStagePatchSequence(repository, [
      { outcome: 'success' },
      { gate: failureGate, outcome: 'failure' },
    ])
    renderBoard()

    await submitStageMove(user, movedCandidate, targetStage)
    await user.click(
      await screen.findByRole('button', {
        name: availableUndoName(movedCandidate),
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`^${viewedCandidate.name} .*후보자 상세 보기$`),
      }),
    )

    const detailDialog = await screen.findByRole('dialog', {
      name: `${viewedCandidate.name} 후보자 상세`,
    })

    failureGate.resolve()

    const alert = await within(detailDialog).findByRole('alert', {
      name: `${movedCandidate.name} 후보자의 단계를 되돌리지 못했어요`,
    })
    const retryName = `${movedCandidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[movedCandidate.currentStage]} 단계로 되돌리기 다시 시도`
    const retryActions = screen.getAllByRole('button', {
      hidden: true,
      name: retryName,
    })

    expect(alert).toHaveTextContent(SAFE_UNDO_FAILURE_MESSAGE)
    expect(retryActions).toHaveLength(1)
    expect(detailDialog).toContainElement(retryActions[0] ?? null)
    expect(
      within(detailDialog).getByRole('button', {
        name: `${viewedCandidate.name} 후보자 단계 변경`,
      }),
    ).toBeEnabled()
  })

  it('보상 결과가 불명확하면 원 후보자의 추가 단계 변경을 막고 상태 재확인을 제공한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)

    installRepositoryHandlers(repository)
    installStagePatchSequence(repository, [
      { outcome: 'success' },
      { outcome: 'network-error' },
      { outcome: 'network-error' },
    ])
    renderBoard()

    await submitStageMove(user, candidate, targetStage)
    await user.click(
      await screen.findByRole('button', {
        name: availableUndoName(candidate),
      }),
    )

    const verificationAlert = await screen.findByRole('alert', {
      name: `${candidate.name} 후보자의 되돌리기 결과를 확인해 주세요`,
    })
    const stageChangeButton = screen.getByRole('button', {
      name: `${candidate.name} 후보자 드래그 · 단계 변경`,
    })

    expect(verificationAlert).toHaveTextContent(
      `${CANDIDATE_STAGE_LABELS[candidate.currentStage]} 단계로 되돌린 결과가 아직 확정되지 않았습니다.`,
    )
    expect(
      within(verificationAlert).getByRole('button', {
        name: `${candidate.name} 후보자의 ${CANDIDATE_STAGE_LABELS[candidate.currentStage]} 단계 되돌리기 상태 다시 확인`,
      }),
    ).toBeEnabled()
    expect(stageChangeButton).toBeDisabled()
    expect(stageChangeButton).not.toHaveAttribute('aria-busy')
  })

  it('provider와 coordinator를 재생성한 hard reload 후에는 지난 Undo를 복원하지 않는다', async () => {
    const user = userEvent.setup()
    const storage: CandidateMockStorage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)

    installRepositoryHandlers(repository)
    installStagePatchSequence(repository, [{ outcome: 'success' }])
    const { queryClient, unmount } = renderBoard()

    await submitStageMove(user, candidate, targetStage)
    expect(
      await screen.findByRole('button', {
        name: availableUndoName(candidate),
      }),
    ).toBeInTheDocument()
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })

    unmount()
    queryClient.clear()
    useBoardDetailStore.setState({ selectedCandidateId: null })

    const reloadedRepository = createCandidateMockRepository({ storage })

    installRepositoryHandlers(reloadedRepository)
    renderBoard()

    await waitFor(() => expectCandidateInStage(candidate, targetStage))
    expect(
      screen.queryByRole('button', { name: availableUndoName(candidate) }),
    ).not.toBeInTheDocument()
    expect(reloadedRepository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })
  })
})
