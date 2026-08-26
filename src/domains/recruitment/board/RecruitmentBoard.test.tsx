import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  generateCandidateFixtures,
} from '@/domains/recruitment/candidates/model'
import { server } from '@/mocks/server'

import { RecruitmentBoard } from './RecruitmentBoard'

const queryClients = new Set<QueryClient>()

function renderBoard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
})
