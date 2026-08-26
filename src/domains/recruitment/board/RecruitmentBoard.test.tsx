import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  generateCandidateFixtures,
} from '@/domains/recruitment/candidates/model'
import { ApiError } from '@/domains/recruitment/candidates/api'
import { server } from '@/mocks/server'

import { RecruitmentBoard } from './RecruitmentBoard'

const queryClients = new Set<QueryClient>()

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

function renderBoard(
  retry: boolean | ((failureCount: number, error: unknown) => boolean) = false,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0 } },
  })
  queryClients.add(queryClient)

  return render(
    <QueryClientProvider client={queryClient}>
      <RecruitmentBoard />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear()
  }
  queryClients.clear()
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
    const board = await screen.findByRole('region', {
      name: '채용 단계별 후보자 보드',
    })
    const card = within(board)
      .getAllByRole('article')
      .find((article) => within(article).queryByText(firstCandidate.name))

    expect(requestCount).toBe(1)
    expect(within(board).getAllByRole('listitem')).toHaveLength(200)
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
      renderBoard(
        (failureCount, error) =>
          failureCount < 1 && error instanceof ApiError && error.retryable,
      )

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
        '전체 200명을 표시합니다.',
      )
      expect(requestCount).toBe(3)
    } finally {
      consoleError.mockRestore()
    }
  })
})
