import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { toast, Toaster } from 'sonner'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest'

import {
  createCandidateHandlers,
  createCandidateMockRepository,
  createMemoryCandidateMockStorage,
  type CandidateMockRepository,
  type CandidateMockStorage,
  type CandidateStageCommitResult,
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

let restoreVirtualizedListDom: (() => void) | undefined

function createDeferred() {
  let resolve: (() => void) | undefined
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })

  return {
    promise,
    resolve() {
      resolve?.()
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

function installRepositoryHandlers(
  repository: CandidateMockRepository,
  wait: (milliseconds: number) => Promise<void> = async () => undefined,
) {
  let requestSequence = 0

  server.use(
    ...createCandidateHandlers({
      createRequestId: () => `stage-move-request-${++requestSequence}`,
      latency: () => 200,
      now: () => new Date('2026-08-26T12:00:00.000Z'),
      repository,
      shouldFail: () => false,
      wait,
    }),
  )
}

function getStageSection(stage: CandidateStage) {
  return screen.getByRole('region', {
    hidden: true,
    name: CANDIDATE_STAGE_LABELS[stage],
  })
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

function getFirstCandidate(repository: CandidateMockRepository) {
  const candidate = repository.list(200)[0]

  if (!candidate) {
    throw new Error('단계 이동 테스트 후보자를 생성하지 못했습니다.')
  }

  return candidate
}

function createStageMoveSuccessResponse(
  result: Extract<
    CandidateStageCommitResult,
    { status: 'updated' | 'replayed' }
  >,
) {
  if (result.receipt.operationKind !== 'move') {
    throw new Error('일반 단계 이동의 성공 응답만 만들 수 있습니다.')
  }

  return candidateStageUpdateResponseSchema.parse({
    data: result.candidate,
    meta: {
      requestId: result.receipt.requestId,
      clientMutationId: result.receipt.clientMutationId,
      undoReceipt: {
        candidateId: result.receipt.candidateId,
        clientMutationId: result.receipt.clientMutationId,
        previousStage: result.receipt.previousStage,
        currentStage: result.receipt.currentStage,
        expectedRevision: result.receipt.expectedRevision,
        committedRevision: result.candidate.revision,
      },
    },
  })
}

function expectCandidateInStage(candidate: Candidate, stage: CandidateStage) {
  const stageSection = getStageSection(stage)

  expect(
    within(stageSection).getByRole('button', {
      hidden: true,
      name: new RegExp(`^${candidate.name} 후보자,`),
    }),
  ).toBeInTheDocument()
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

describe('RecruitmentBoard candidate stage move', () => {
  it('응답 전에 목적 단계를 투영하고 성공 뒤 목록·상세·재접속 결과를 확정한다', async () => {
    const user = userEvent.setup()
    const storage: CandidateMockStorage = createMemoryCandidateMockStorage()
    const repository = createCandidateMockRepository({ storage })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const patchGate = createDeferred()
    let waitCount = 0

    installRepositoryHandlers(repository, async () => {
      waitCount += 1

      if (waitCount === 3) {
        await patchGate.promise
      }
    })

    const { queryClient, unmount } = renderBoard()
    const detailButton = await screen.findByRole('button', {
      name: new RegExp(`^${candidate.name} 후보자,`),
    })

    await user.click(detailButton)

    const detailDialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 상세`,
    })

    await within(detailDialog).findByRole('region', {
      name: `${candidate.name} 후보자 상세 정보`,
    })
    await user.click(
      within(detailDialog).getByRole('button', {
        name: `${candidate.name} 후보자 단계 변경`,
      }),
    )

    const stageDialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 단계 변경`,
    })

    expect(within(stageDialog).getAllByRole('radio')).toHaveLength(4)
    expect(
      within(stageDialog).queryByRole('radio', {
        name: CANDIDATE_STAGE_LABELS[candidate.currentStage],
      }),
    ).not.toBeInTheDocument()

    await user.click(
      within(stageDialog).getByRole('radio', {
        name: CANDIDATE_STAGE_LABELS[targetStage],
      }),
    )
    await user.click(
      within(stageDialog).getByRole('button', { name: '변경하기' }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: `${candidate.name} 후보자 단계 변경`,
        }),
      ).not.toBeInTheDocument()
    })
    expectCandidateInStage(candidate, targetStage)
    expect(
      within(getStageSection(candidate.currentStage)).queryByRole('button', {
        hidden: true,
        name: new RegExp(`^${candidate.name} 후보자,`),
      }),
    ).not.toBeInTheDocument()
    expect(repository.getById(candidate.id)).toEqual(candidate)
    expect(
      within(detailDialog).getAllByText(CANDIDATE_STAGE_LABELS[targetStage]),
    ).not.toHaveLength(0)
    expect(
      screen.queryByText(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계로 이동했습니다.`,
      ),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        within(detailDialog).getByRole('button', {
          name: `${candidate.name} 후보자 저장 중 · 변경`,
        }),
      ).toHaveFocus()
    })

    patchGate.resolve()

    expect(
      await screen.findByText(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계로 이동했습니다.`,
      ),
    ).toBeInTheDocument()
    expect(
      within(detailDialog).getAllByText(CANDIDATE_STAGE_LABELS[targetStage]),
    ).not.toHaveLength(0)
    expectCandidateInStage(candidate, targetStage)

    await user.click(within(detailDialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: `${candidate.name} 후보자 상세`,
        }),
      ).not.toBeInTheDocument()
    })
    expectCandidateInStage(candidate, targetStage)
    expect(
      within(getStageSection(candidate.currentStage)).queryByRole('button', {
        hidden: true,
        name: new RegExp(`^${candidate.name} 후보자,`),
      }),
    ).not.toBeInTheDocument()

    unmount()
    queryClient.clear()
    useBoardDetailStore.setState({ selectedCandidateId: null })

    const reloadedRepository = createCandidateMockRepository({ storage })
    installRepositoryHandlers(reloadedRepository)
    const { queryClient: reloadedQueryClient } = renderBoard()

    await waitFor(() => expectCandidateInStage(candidate, targetStage))

    await user.click(
      within(getStageSection(targetStage)).getByRole('button', {
        name: new RegExp(`^${candidate.name} 후보자,`),
      }),
    )

    const reloadedDetail = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 상세`,
    })

    expect(
      await within(reloadedDetail).findAllByText(
        CANDIDATE_STAGE_LABELS[targetStage],
      ),
    ).not.toHaveLength(0)
    reloadedQueryClient.clear()
  }, 10_000)

  it('실패한 작업만 이전 단계로 되돌리고 안전한 재시도를 제공한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const patchGate = createDeferred()
    const retryGate = createDeferred()
    let shouldFailCount = 0
    let waitCount = 0

    server.use(
      ...createCandidateHandlers({
        createRequestId: () => 'stage-move-failure-request',
        latency: () => 200,
        repository,
        shouldFail: () => {
          shouldFailCount += 1
          return shouldFailCount === 2
        },
        wait: async () => {
          waitCount += 1

          if (waitCount === 2) {
            await patchGate.promise
          }

          if (waitCount === 3) {
            await retryGate.promise
          }
        },
      }),
    )

    renderBoard()

    await user.click(
      await screen.findByRole('button', {
        name: `${candidate.name} 후보자 단계 변경`,
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
    expectCandidateInStage(candidate, targetStage)
    expect(repository.getById(candidate.id)).toEqual(candidate)
    await waitFor(() => {
      expect(
        within(getStageSection(targetStage)).getByRole('button', {
          hidden: true,
          name: `${candidate.name} 후보자 저장 중 · 변경`,
        }),
      ).toHaveFocus()
    })

    patchGate.resolve()

    const boardRegion = screen.getByRole('region', {
      name: '채용 단계별 후보자',
    })
    const alert = await within(boardRegion).findByRole('alert')

    expect(alert).toHaveTextContent(
      '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
    )
    expect(alert).not.toHaveTextContent('SIMULATED_FAILURE')
    expectCandidateInStage(candidate, candidate.currentStage)
    expect(
      within(getStageSection(targetStage)).queryByRole('button', {
        hidden: true,
        name: new RegExp(`^${candidate.name} 후보자,`),
      }),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        within(getStageSection(candidate.currentStage)).getByRole('button', {
          hidden: true,
          name: `${candidate.name} 후보자 단계 변경`,
        }),
      ).toHaveFocus()
    })

    await user.click(
      within(alert).getByRole('button', {
        name: `${candidate.name} 후보자 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계 이동 다시 시도`,
      }),
    )

    expectCandidateInStage(candidate, targetStage)
    expect(within(boardRegion).queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        within(getStageSection(targetStage)).getByRole('button', {
          hidden: true,
          name: `${candidate.name} 후보자 저장 중 · 변경`,
        }),
      ).toHaveFocus()
    })

    retryGate.resolve()

    expect(
      await screen.findAllByText(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계로 이동했습니다.`,
      ),
    ).not.toHaveLength(0)
  })

  it('결과가 불명확하면 재확인 진행 상태를 알리고 같은 이동을 확정한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const verificationGate = createDeferred()
    let detailRequestCount = 0
    let patchRequestCount = 0

    installRepositoryHandlers(repository)
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () => {
        patchRequestCount += 1

        return patchRequestCount <= 2 ? HttpResponse.error() : undefined
      }),
      http.get('*/api/candidates/:candidateId', async ({ params }) => {
        detailRequestCount += 1

        if (detailRequestCount === 2) {
          await verificationGate.promise
        }

        const confirmedCandidate = repository.getById(
          String(params.candidateId),
        )

        if (confirmedCandidate === undefined) {
          return HttpResponse.json(
            { error: { code: 'NOT_FOUND' } },
            { status: 404 },
          )
        }

        return HttpResponse.json({ data: confirmedCandidate })
      }),
    )

    renderBoard()

    await user.click(
      await screen.findByRole('button', {
        name: `${candidate.name} 후보자 단계 변경`,
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

    const verificationButton = await screen.findByRole('button', {
      name: `${candidate.name} 후보자 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계 이동 상태 다시 확인`,
    })

    expectCandidateInStage(candidate, targetStage)
    expect(repository.getById(candidate.id)).toEqual(candidate)
    await user.click(verificationButton)

    const pendingVerificationButton = screen.getByRole('button', {
      name: `${candidate.name} 후보자 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계 이동 상태 확인 중`,
    })

    expect(pendingVerificationButton).toBeDisabled()
    expect(pendingVerificationButton).toHaveAttribute('aria-busy', 'true')
    expect(pendingVerificationButton).toHaveTextContent('확인 중')
    expect(detailRequestCount).toBe(2)

    verificationGate.resolve()

    expect(
      await screen.findAllByText(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계로 이동했습니다.`,
      ),
    ).not.toHaveLength(0)
    expect(patchRequestCount).toBe(3)
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: targetStage,
      revision: candidate.revision + 1,
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: `${candidate.name} 후보자 단계 변경`,
        }),
      ).toHaveFocus()
    })
  })

  it('응답 전 다시 이동하면 최신 의도를 바로 투영하고 revision을 이어서 저장한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const [firstTargetStage, finalTargetStage] = CANDIDATE_STAGES.filter(
      (stage) => stage !== candidate.currentStage,
    )
    const firstPatchGate = createDeferred()
    const secondPatchGate = createDeferred()
    const toastSuccess = vi.spyOn(toast, 'success')
    const patchBodies: CandidateStageUpdateRequest[] = []

    onTestFinished(() => toastSuccess.mockRestore())

    if (!firstTargetStage || !finalTargetStage) {
      throw new Error('연속 이동을 검증할 두 단계를 찾지 못했습니다.')
    }

    installRepositoryHandlers(repository)
    server.use(
      http.patch(
        '*/api/candidates/:candidateId/stage',
        async ({ params, request }) => {
          const body = candidateStageUpdateRequestSchema.parse(
            await request.json(),
          )
          const requestIndex = patchBodies.push(body) - 1

          await (requestIndex === 0
            ? firstPatchGate.promise
            : secondPatchGate.promise)

          const operationTime = new Date(
            Date.parse('2026-08-27T03:00:00.000Z') + requestIndex * 60_000,
          ).toISOString()
          const result = repository.commitStage({
            candidateId: String(params.candidateId),
            clientMutationId: body.clientMutationId,
            committedAt: operationTime,
            currentStage: body.stage,
            expectedRevision: body.expectedRevision,
            requestId: `move-race-request-${requestIndex + 1}`,
            stageChangedAt: operationTime,
          })

          if (result.status !== 'updated') {
            throw new Error('연속 단계 이동을 확정하지 못했습니다.')
          }

          return HttpResponse.json(createStageMoveSuccessResponse(result))
        },
      ),
    )

    renderBoard()

    const firstTargetSuccessMessage = `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[firstTargetStage]} 단계로 이동했습니다.`
    const finalTargetSuccessMessage = `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[finalTargetStage]} 단계로 이동했습니다.`

    toastSuccess.mockClear()

    await user.click(
      await screen.findByRole('button', {
        name: `${candidate.name} 후보자 단계 변경`,
      }),
    )
    let dialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 단계 변경`,
    })

    await user.click(
      within(dialog).getByRole('radio', {
        name: CANDIDATE_STAGE_LABELS[firstTargetStage],
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: '변경하기' }))

    await waitFor(() => expectCandidateInStage(candidate, firstTargetStage))
    await waitFor(() => expect(patchBodies).toHaveLength(1))

    const pendingStageButton = within(
      getStageSection(firstTargetStage),
    ).getByRole('button', {
      hidden: true,
      name: `${candidate.name} 후보자 저장 중 · 변경`,
    })

    expect(pendingStageButton).toBeEnabled()
    expect(pendingStageButton).toHaveAttribute('aria-busy', 'true')
    await user.click(pendingStageButton)

    dialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 단계 변경`,
    })
    expect(
      within(dialog).queryByRole('radio', {
        name: CANDIDATE_STAGE_LABELS[firstTargetStage],
      }),
    ).not.toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('radio', {
        name: CANDIDATE_STAGE_LABELS[finalTargetStage],
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: '변경하기' }))

    await waitFor(() => expectCandidateInStage(candidate, finalTargetStage))
    expect(
      within(getStageSection(firstTargetStage)).queryByRole('button', {
        hidden: true,
        name: new RegExp(`^${candidate.name} 후보자,`),
      }),
    ).not.toBeInTheDocument()
    expect(patchBodies).toHaveLength(1)

    firstPatchGate.resolve()

    await waitFor(() => expect(patchBodies).toHaveLength(2))
    expect(patchBodies[0]).toMatchObject({
      expectedRevision: candidate.revision,
      stage: firstTargetStage,
    })
    expect(patchBodies[1]).toMatchObject({
      expectedRevision: candidate.revision + 1,
      stage: finalTargetStage,
    })
    expect(toastSuccess).not.toHaveBeenCalledWith(
      firstTargetSuccessMessage,
      expect.anything(),
    )

    secondPatchGate.resolve()

    expect(
      await screen.findAllByText(finalTargetSuccessMessage),
    ).not.toHaveLength(0)
    expect(toastSuccess).toHaveBeenCalledWith(
      finalTargetSuccessMessage,
      expect.anything(),
    )
    expect(repository.getById(candidate.id)).toMatchObject({
      currentStage: finalTargetStage,
      revision: candidate.revision + 2,
    })
    expectCandidateInStage(candidate, finalTargetStage)
    expect(
      within(getStageSection(finalTargetStage)).getByRole('button', {
        hidden: true,
        name: `${candidate.name} 후보자 단계 변경`,
      }),
    ).not.toHaveAttribute('aria-busy')
  })

  it('상세 모달에서 실패를 알리고 키보드 재시도 뒤 상세 내용으로 포커스를 회복한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    const retryGate = createDeferred()
    let patchAttempt = 0

    installRepositoryHandlers(repository)
    server.use(
      http.patch(
        '*/api/candidates/:candidateId/stage',
        async ({ params, request }) => {
          const candidateId = String(params.candidateId)
          const body = candidateStageUpdateRequestSchema.parse(
            await request.json(),
          )

          patchAttempt += 1

          if (patchAttempt === 1) {
            return HttpResponse.json(
              {
                error: {
                  code: 'SIMULATED_FAILURE',
                  message: 'internal failure detail',
                  requestId: 'detail-stage-move-failure',
                  retryable: true,
                },
              },
              {
                headers: { 'x-request-id': 'detail-stage-move-failure' },
                status: 503,
              },
            )
          }

          await retryGate.promise

          const operationTime = '2026-08-26T12:00:00.000Z'
          const result = repository.commitStage({
            candidateId,
            clientMutationId: body.clientMutationId,
            committedAt: operationTime,
            currentStage: body.stage,
            expectedRevision: body.expectedRevision,
            requestId: 'detail-stage-move-retry-success',
            stageChangedAt: operationTime,
          })

          if (result.status !== 'updated') {
            throw new Error('상세 모달 재시도를 확정하지 못했습니다.')
          }

          return HttpResponse.json(createStageMoveSuccessResponse(result))
        },
      ),
    )

    renderBoard()

    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(`^${candidate.name} 후보자,`),
      }),
    )

    const detailDialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 상세`,
    })

    await within(detailDialog).findByRole('region', {
      name: `${candidate.name} 후보자 상세 정보`,
    })
    await user.click(
      within(detailDialog).getByRole('button', {
        name: `${candidate.name} 후보자 단계 변경`,
      }),
    )

    const stageDialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 단계 변경`,
    })

    await user.click(
      within(stageDialog).getByRole('radio', {
        name: CANDIDATE_STAGE_LABELS[targetStage],
      }),
    )
    await user.click(
      within(stageDialog).getByRole('button', { name: '변경하기' }),
    )

    const alert = await within(detailDialog).findByRole('alert')
    const retryButton = within(alert).getByRole('button', {
      name: `${candidate.name} 후보자 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계 이동 다시 시도`,
    })

    expect(alert).toHaveTextContent(
      '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
    )
    expect(alert).not.toHaveTextContent('internal failure detail')
    expect(
      screen.getByRole('dialog', { name: `${candidate.name} 후보자 상세` }),
    ).toBe(detailDialog)

    retryButton.focus()
    expect(retryButton).toHaveFocus()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(within(detailDialog).queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByTestId('candidate-detail-content')).toHaveFocus()
    })
    expect(
      screen.getByRole('dialog', { name: `${candidate.name} 후보자 상세` }),
    ).toBe(detailDialog)
    expect(
      within(detailDialog).getAllByText(CANDIDATE_STAGE_LABELS[targetStage]),
    ).not.toHaveLength(0)

    retryGate.resolve()

    expect(
      await screen.findAllByText(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계로 이동했습니다.`,
      ),
    ).not.toHaveLength(0)
  })

  it('한 후보자의 롤백이 다른 후보자의 먼저 확정된 이동을 지우지 않는다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const [firstCandidate, secondCandidate] = repository.list(200)

    if (!firstCandidate || !secondCandidate) {
      throw new Error('격리 롤백 테스트 후보자를 생성하지 못했습니다.')
    }

    const firstTargetStage = findDifferentStage(firstCandidate.currentStage)
    const secondTargetStage = findDifferentStage(secondCandidate.currentStage)
    const firstPatchGate = createDeferred()
    const secondPatchGate = createDeferred()

    installRepositoryHandlers(repository)
    server.use(
      http.patch(
        '*/api/candidates/:candidateId/stage',
        async ({ params, request }) => {
          const candidateId = String(params.candidateId)
          const body = candidateStageUpdateRequestSchema.parse(
            await request.json(),
          )

          if (candidateId === firstCandidate.id) {
            await firstPatchGate.promise

            return HttpResponse.json(
              {
                error: {
                  code: 'SIMULATED_FAILURE',
                  message: 'internal failure detail',
                  requestId: 'isolated-first-failure',
                  retryable: true,
                },
              },
              {
                headers: { 'x-request-id': 'isolated-first-failure' },
                status: 503,
              },
            )
          }

          await secondPatchGate.promise

          const operationTime = '2026-08-26T12:00:00.000Z'
          const result = repository.commitStage({
            candidateId,
            clientMutationId: body.clientMutationId,
            committedAt: operationTime,
            currentStage: body.stage,
            expectedRevision: body.expectedRevision,
            requestId: 'isolated-second-success',
            stageChangedAt: operationTime,
          })

          if (result.status !== 'updated') {
            throw new Error('두 번째 후보자 이동을 확정하지 못했습니다.')
          }

          return HttpResponse.json(createStageMoveSuccessResponse(result))
        },
      ),
    )

    renderBoard()

    const submitMove = async (candidate: Candidate, stage: CandidateStage) => {
      await user.click(
        await screen.findByRole('button', {
          name: `${candidate.name} 후보자 단계 변경`,
        }),
      )

      const dialog = await screen.findByRole('dialog', {
        name: `${candidate.name} 후보자 단계 변경`,
      })

      await user.click(
        within(dialog).getByRole('radio', {
          name: CANDIDATE_STAGE_LABELS[stage],
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

    await submitMove(firstCandidate, firstTargetStage)
    await submitMove(secondCandidate, secondTargetStage)

    expectCandidateInStage(firstCandidate, firstTargetStage)
    expectCandidateInStage(secondCandidate, secondTargetStage)

    secondPatchGate.resolve()

    expect(
      await screen.findAllByText(
        `${secondCandidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[secondTargetStage]} 단계로 이동했습니다.`,
      ),
    ).not.toHaveLength(0)

    firstPatchGate.resolve()

    expect(
      (await screen.findAllByRole('alert')).some((alert) =>
        alert.textContent?.includes(
          '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
        ),
      ),
    ).toBe(true)
    await waitFor(() => {
      expectCandidateInStage(firstCandidate, firstCandidate.currentStage)
      expectCandidateInStage(secondCandidate, secondTargetStage)
    })
    expect(repository.getById(secondCandidate.id)?.currentStage).toBe(
      secondTargetStage,
    )
  })
})
