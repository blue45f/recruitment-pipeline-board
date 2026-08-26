import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  type Candidate,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'
import { server } from '@/mocks/server'
import { installVirtualizedListDomMocks } from '@/test/installVirtualizedListDomMocks'

import { useBoardDetailStore, useBoardPreferencesStore } from './model'
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
      <MemoryRouter>
        <RecruitmentBoard />
        <Toaster position="bottom-center" />
      </MemoryRouter>
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
  it('응답 전에는 기존 단계를 유지하고 성공 뒤 목록·상세·재접속 결과를 갱신한다', async () => {
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

    expect(
      within(stageDialog).getByRole('button', {
        name: `${candidate.name} 후보자 단계 저장 중`,
      }),
    ).toBeDisabled()
    expectCandidateInStage(candidate, candidate.currentStage)

    await user.keyboard('{Escape}')
    expect(stageDialog).toBeInTheDocument()

    patchGate.resolve()

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: `${candidate.name} 후보자 단계 변경`,
        }),
      ).not.toBeInTheDocument()
    })
    expect(
      await screen.findByText(
        `${candidate.name} 후보자를 ${CANDIDATE_STAGE_LABELS[targetStage]} 단계로 이동했습니다.`,
      ),
    ).toBeInTheDocument()
    expect(
      within(detailDialog).getAllByText(CANDIDATE_STAGE_LABELS[targetStage]),
    ).not.toHaveLength(0)
    expect(
      within(detailDialog).getByRole('button', {
        name: `${candidate.name} 후보자 단계 변경`,
      }),
    ).toHaveFocus()

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
  })

  it('Mock API 실패 원문을 숨기고 후보자를 기존 단계에 유지한다', async () => {
    const user = userEvent.setup()
    const repository = createCandidateMockRepository({
      storage: createMemoryCandidateMockStorage(),
    })
    const candidate = getFirstCandidate(repository)
    const targetStage = findDifferentStage(candidate.currentStage)
    let shouldFailCount = 0

    server.use(
      ...createCandidateHandlers({
        createRequestId: () => 'stage-move-failure-request',
        latency: () => 200,
        repository,
        shouldFail: () => {
          shouldFailCount += 1
          return shouldFailCount === 2
        },
        wait: async () => undefined,
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

    const alert = await within(dialog).findByRole('alert')

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
  })
})
