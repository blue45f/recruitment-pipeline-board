import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, useLocation } from 'react-router'
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
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  generateCandidateFixtures,
  type Candidate,
} from '@/domains/recruitment/candidates/model'
import { server } from '@/mocks/server'
import { installVirtualizedListDomMocks } from '@/test/installVirtualizedListDomMocks'

import { useBoardDetailStore, useBoardPreferencesStore } from './model'
import { CandidateMovementProvider } from './movement'
import { RecruitmentBoard } from './RecruitmentBoard'

const queryClients = new Set<QueryClient>()
let restoreVirtualizedListDom: (() => void) | undefined

const FILTER_CANDIDATES = [
  {
    id: 'candidate-integration-frontend',
    name: '김프론트',
    role: 'frontend_engineer',
    appliedAt: '2026-06-01T09:00:00.000Z',
    currentStage: 'document_review',
    email: 'candidate-integration-frontend@example.test',
    experienceYears: 5,
    memo: '검색 필터 통합 테스트를 위한 프론트엔드 후보자입니다.',
    stageChangedAt: '2026-06-08T09:00:00.000Z',
    revision: 1,
  },
  {
    id: 'candidate-integration-backend',
    name: '김백엔드',
    role: 'backend_engineer',
    appliedAt: '2026-06-02T09:00:00.000Z',
    currentStage: 'interview',
    email: 'candidate-integration-backend@example.test',
    experienceYears: 7,
    memo: '검색 필터 통합 테스트를 위한 백엔드 후보자입니다.',
    stageChangedAt: '2026-06-09T09:00:00.000Z',
    revision: 1,
  },
] as const satisfies readonly Candidate[]

type RenderBoardOptions = Readonly<{
  initialEntry?: string
}>

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

function LocationSearchProbe() {
  const location = useLocation()

  return <output data-testid="location-search">{location.search}</output>
}

function renderBoard({ initialEntry = '/' }: RenderBoardOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, staleTime: 30_000 },
    },
  })
  queryClients.add(queryClient)

  return render(
    <QueryClientProvider client={queryClient}>
      <CandidateMovementProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <RecruitmentBoard />
          <LocationSearchProbe />
        </MemoryRouter>
      </CandidateMovementProvider>
    </QueryClientProvider>,
  )
}

function currentSearchParams() {
  return new URLSearchParams(screen.getByTestId('location-search').textContent)
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
  useBoardPreferencesStore.setState({ listSize: 200 })
  localStorage.clear()
})

afterEach(() => {
  useBoardDetailStore.setState({ selectedCandidateId: null })
  useBoardPreferencesStore.setState({ listSize: 200 })
  localStorage.clear()

  for (const queryClient of queryClients) {
    queryClient.clear()
  }
  queryClients.clear()
})

afterAll(() => {
  restoreVirtualizedListDom?.()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

describe('RecruitmentBoard', () => {
  it('목록을 한 번 요청해 후보자를 현재 단계에 표시한다', async () => {
    const candidates = generateCandidateFixtures({ seed: 20260826, size: 200 })
    const firstCandidate = candidates[0]
    let requestCount = 0

    if (!firstCandidate) {
      throw new Error('테스트 후보자를 생성하지 못했습니다.')
    }

    server.use(
      http.get('*/api/candidates', ({ request }) => {
        requestCount += 1
        expect(new URL(request.url).searchParams.get('size')).toBe('200')

        return HttpResponse.json({
          data: candidates,
          meta: { total: candidates.length },
        })
      }),
    )

    renderBoard()

    expect(
      screen.getByRole('heading', { name: '채용 후보자 보드', level: 1 }),
    ).toBeInTheDocument()
    const board = await screen.findByRole(
      'region',
      { name: '채용 단계별 후보자 보드' },
      { timeout: 5_000 },
    )
    const card = within(board)
      .getAllByRole('article')
      .find((article) => within(article).queryByText(firstCandidate.name))

    expect(requestCount).toBe(1)
    const renderedItems = within(board).getAllByRole('listitem')

    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThan(60)
    expect(card).toBeDefined()

    if (!card) {
      throw new Error('후보자 카드를 찾지 못했습니다.')
    }

    expect(within(card).getByText('지원일')).toBeInTheDocument()
    expect(card).toHaveTextContent(CANDIDATE_ROLE_LABELS[firstCandidate.role])
    expect(card).toHaveTextContent(
      CANDIDATE_STAGE_LABELS[firstCandidate.currentStage],
    )
  })

  it('목록 응답을 기다리는 동안 보드 크기를 예약한 스켈레톤을 표시한다', async () => {
    const candidates = generateCandidateFixtures({ seed: 20260826, size: 200 })
    const responseGate = createDeferred()

    server.use(
      http.get('*/api/candidates', async () => {
        await responseGate.promise

        return HttpResponse.json({
          data: candidates,
          meta: { total: candidates.length },
        })
      }),
    )

    renderBoard()

    expect(
      screen.getByRole('status', {
        name: '후보자 목록을 불러오는 중입니다',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('candidate-stage-skeleton')).toHaveLength(5)

    responseGate.resolve()

    expect(
      await screen.findByRole('region', { name: '채용 단계별 후보자 보드' }),
    ).toBeInTheDocument()
  })

  it('1,000명 시나리오를 실제 API로 요청하고 보이는 카드만 유지한다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({
      seed: 20260826,
      size: 1_000,
    })
    const requestedSizes: string[] = []

    server.use(
      http.get('*/api/candidates', ({ request }) => {
        const size = new URL(request.url).searchParams.get('size')

        requestedSizes.push(size ?? '')

        const requestedCandidates =
          size === '1000' ? candidates : candidates.slice(0, 200)

        return HttpResponse.json({
          data: requestedCandidates,
          meta: { total: requestedCandidates.length },
        })
      }),
    )

    renderBoard()

    await screen.findByRole('region', {
      name: '채용 단계별 후보자 보드',
    })

    await waitFor(() => {
      expect(requestedSizes).toEqual(['200'])
    })

    const listSizeSelect = screen.getByRole('combobox', {
      name: '표시할 데이터 후보자 200명',
    })

    listSizeSelect.focus()
    await user.keyboard(' ')
    await screen.findByRole('option', {
      name: '후보자 1,000명 · 가상 목록',
    })
    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => {
      expect(
        within(
          screen.getByRole('region', {
            name: '채용 단계별 후보자',
          }),
        ).getByRole('status'),
      ).toHaveTextContent('전체 1,000명 중 1,000명을 표시합니다.')
    })

    const board = screen.getByRole('region', {
      name: '채용 단계별 후보자 보드',
    })
    const renderedItems = within(board).getAllByRole('listitem')

    expect(requestedSizes).toEqual(['200', '1000'])
    expect(useBoardPreferencesStore.getState().listSize).toBe(1_000)
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThanOrEqual(60)
    expect(
      within(board).getAllByRole('list', { name: /후보자 200명$/ }),
    ).toHaveLength(5)
  })

  it('후보자가 한 명도 없으면 전체 데이터 빈 상태를 표시한다', async () => {
    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
    )

    renderBoard()

    expect(
      await screen.findByRole('heading', {
        name: '등록된 후보자가 없습니다',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: '채용 단계별 후보자 보드' }),
    ).not.toBeInTheDocument()
  })

  it('안전한 오류 문구를 표시하고 사용자의 재시도로 복구한다', async () => {
    const user = userEvent.setup()
    const candidates = generateCandidateFixtures({ seed: 20260826, size: 200 })
    const internalMessage = 'database password leaked from upstream'
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    let requestCount = 0

    server.use(
      http.get('*/api/candidates', () => {
        requestCount += 1

        if (requestCount <= 2) {
          return HttpResponse.json(
            { message: internalMessage },
            {
              headers: { 'x-request-id': 'board-error-1' },
              status: 503,
            },
          )
        }

        return HttpResponse.json({
          data: candidates,
          meta: { total: candidates.length },
        })
      }),
    )

    try {
      renderBoard()

      const errorAlert = await screen.findByRole('alert')
      const boardRegion = screen.getByRole('region', {
        name: '채용 단계별 후보자',
      })

      expect(errorAlert).toHaveTextContent('보드를 불러오지 못했어요')
      expect(errorAlert).toHaveTextContent(
        '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
      )
      expect(errorAlert).not.toHaveTextContent(internalMessage)
      expect(requestCount).toBe(2)

      const retryButton = within(errorAlert).getByRole('button', {
        name: '다시 시도',
      })

      retryButton.focus()
      await user.keyboard('{Enter}')

      expect(boardRegion).toHaveFocus()
      expect(
        await screen.findByRole('region', {
          name: '채용 단계별 후보자 보드',
        }),
      ).toBeInTheDocument()
      expect(boardRegion).toHaveFocus()
      expect(within(boardRegion).getByRole('status')).toHaveTextContent(
        '전체 200명 중 200명을 표시합니다.',
      )
      expect(requestCount).toBe(3)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('이름과 직무 필터를 URL에 반영하면서 목록 API는 다시 호출하지 않는다', async () => {
    const user = userEvent.setup()
    let requestCount = 0

    server.use(
      http.get('*/api/candidates', () => {
        requestCount += 1

        return HttpResponse.json({
          data: FILTER_CANDIDATES,
          meta: { total: FILTER_CANDIDATES.length },
        })
      }),
    )

    renderBoard()

    expect(await screen.findByText('김프론트')).toBeInTheDocument()
    expect(screen.getByText('김백엔드')).toBeInTheDocument()

    await user.type(
      screen.getByRole('searchbox', { name: '후보자 검색' }),
      '김',
    )

    await waitFor(() => {
      expect(currentSearchParams().get('query')).toBe('김')
    })

    const roleSelect = screen.getByRole('combobox', {
      name: '직무 전체 직무',
    })
    roleSelect.focus()
    await user.keyboard(' ')
    await screen.findByRole('option', { name: '전체 직무' })
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    await waitFor(() => {
      expect(currentSearchParams().get('role')).toBe('backend_engineer')
      expect(screen.queryByText('김프론트')).not.toBeInTheDocument()
    })
    expect(screen.getByText('김백엔드')).toBeInTheDocument()
    expect(requestCount).toBe(1)
  })

  it('URL의 잘못된 직무만 기본값으로 되돌리고 유효한 검색어는 복원한다', async () => {
    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json({
          data: FILTER_CANDIDATES,
          meta: { total: FILTER_CANDIDATES.length },
        }),
      ),
    )

    renderBoard({ initialEntry: '/?query=%EA%B9%80&role=unknown' })

    expect(await screen.findByText('김프론트')).toBeInTheDocument()
    expect(screen.getByText('김백엔드')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '후보자 검색' })).toHaveValue(
      '김',
    )
    expect(
      screen.getByRole('combobox', { name: '직무 전체 직무' }),
    ).toHaveTextContent('전체 직무')
  })

  it('검색 결과를 키보드로 지우면 입력에 포커스를 돌려주고 전체 목록을 보여준다', async () => {
    const user = userEvent.setup()
    let requestCount = 0

    server.use(
      http.get('*/api/candidates', () => {
        requestCount += 1

        return HttpResponse.json({
          data: FILTER_CANDIDATES,
          meta: { total: FILTER_CANDIDATES.length },
        })
      }),
    )

    renderBoard()

    expect(await screen.findByText('김프론트')).toBeInTheDocument()

    await user.type(
      screen.getByRole('searchbox', { name: '후보자 검색' }),
      '없는 후보자',
    )

    expect(
      await screen.findByRole('heading', {
        name: '조건에 맞는 후보자가 없습니다',
      }),
    ).toBeInTheDocument()
    expect(currentSearchParams().get('query')).toBe('없는 후보자')

    const clearFiltersButton = screen.getByRole('button', {
      name: '검색 조건 지우기',
    })
    clearFiltersButton.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('김프론트')).toBeInTheDocument()
    expect(screen.getByText('김백엔드')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '후보자 검색' })).toHaveFocus()
    expect(currentSearchParams().get('query')).toBeNull()
    expect(requestCount).toBe(1)
  })

  it('의도 기반 상세 요청을 클릭 뒤에도 공유하고 닫을 때 원래 카드로 돌아간다', async () => {
    const user = userEvent.setup()
    const candidate = FILTER_CANDIDATES[0]
    const detailResponseGate = createDeferred()
    let detailRequestCount = 0

    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json({
          data: FILTER_CANDIDATES,
          meta: { total: FILTER_CANDIDATES.length },
        }),
      ),
      http.get('*/api/candidates/:candidateId', async ({ params }) => {
        detailRequestCount += 1
        expect(params.candidateId).toBe(candidate.id)
        await detailResponseGate.promise

        return HttpResponse.json({ data: candidate })
      }),
    )

    renderBoard()

    const cardButton = await screen.findByRole('button', {
      name: new RegExp(`^${candidate.name} 후보자,`),
    })

    cardButton.focus()
    await waitFor(() => expect(detailRequestCount).toBe(1))
    await user.keyboard('{Enter}')

    const dialog = await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 상세`,
    })

    expect(dialog).toHaveAccessibleDescription(
      `${candidate.name} 후보자의 지원 정보와 현재 채용 단계를 확인합니다.`,
    )
    expect(
      within(dialog).getByRole('status', {
        name: '후보자 상세 정보를 불러오는 중입니다',
      }),
    ).toBeInTheDocument()
    expect(detailRequestCount).toBe(1)

    detailResponseGate.resolve()

    expect(
      await within(dialog).findByRole('region', {
        name: `${candidate.name} 후보자 상세 정보`,
      }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('status', {
        name: `${candidate.name} 후보자 상세 정보를 불러왔습니다.`,
      }),
    ).toBeInTheDocument()
    expect(detailRequestCount).toBe(1)

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(cardButton).toHaveFocus()
    })

    await user.click(cardButton)
    await screen.findByRole('dialog', {
      name: `${candidate.name} 후보자 상세`,
    })
    await user.click(screen.getByRole('button', { name: '닫기' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(cardButton).toHaveFocus()
    })
    expect(detailRequestCount).toBe(1)
  })

  it('상세 조회 오류를 모달 안에서 안전하게 처리하고 키보드 재시도로 복구한다', async () => {
    const user = userEvent.setup()
    const candidate = FILTER_CANDIDATES[0]
    const internalMessage = 'detail database password leaked from upstream'
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    let detailRequestCount = 0

    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json({
          data: FILTER_CANDIDATES,
          meta: { total: FILTER_CANDIDATES.length },
        }),
      ),
      http.get('*/api/candidates/:candidateId', () => {
        detailRequestCount += 1

        if (detailRequestCount <= 2) {
          return HttpResponse.json(
            { message: internalMessage },
            {
              headers: { 'x-request-id': 'detail-error-1' },
              status: 503,
            },
          )
        }

        return HttpResponse.json({ data: candidate })
      }),
    )

    try {
      renderBoard()
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(`^${candidate.name} 후보자,`),
        }),
      )

      const dialog = await screen.findByRole('dialog', {
        name: `${candidate.name} 후보자 상세`,
      })
      const errorAlert = await within(dialog).findByRole('alert')

      expect(errorAlert).toHaveTextContent('상세 정보를 불러오지 못했어요')
      expect(errorAlert).toHaveTextContent(
        '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
      )
      expect(errorAlert).not.toHaveTextContent(internalMessage)
      expect(screen.getByText('김백엔드')).toBeInTheDocument()

      const retryButton = within(errorAlert).getByRole('button', {
        name: '다시 시도',
      })
      retryButton.focus()
      await user.keyboard('{Enter}')

      expect(screen.getByTestId('candidate-detail-content')).toHaveFocus()
      expect(
        await within(dialog).findByRole('region', {
          name: `${candidate.name} 후보자 상세 정보`,
        }),
      ).toBeInTheDocument()
      expect(detailRequestCount).toBe(3)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('찾을 수 없는 후보자 상세에는 재시도를 노출하지 않는다', async () => {
    const user = userEvent.setup()
    const candidate = FILTER_CANDIDATES[0]
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    server.use(
      http.get('*/api/candidates', () =>
        HttpResponse.json({
          data: FILTER_CANDIDATES,
          meta: { total: FILTER_CANDIDATES.length },
        }),
      ),
      http.get('*/api/candidates/:candidateId', () =>
        HttpResponse.json(
          { message: 'internal candidate lookup detail' },
          { status: 404 },
        ),
      ),
    )

    try {
      renderBoard()
      const cardButton = await screen.findByRole('button', {
        name: new RegExp(`^${candidate.name} 후보자,`),
      })
      await user.click(cardButton)

      const errorAlert = await screen.findByRole('alert')

      expect(errorAlert).toHaveTextContent('지원자를 찾을 수 없습니다.')
      expect(
        within(errorAlert).queryByRole('button', { name: '다시 시도' }),
      ).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '닫기' }))
      await waitFor(() => expect(cardButton).toHaveFocus())
    } finally {
      consoleError.mockRestore()
    }
  })
})
