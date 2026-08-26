import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { generateCandidateFixtures } from '@/domains/recruitment/candidates/model'
import { server } from '@/mocks/server'

import { useBoardDetailStore } from '../model'
import { CandidateDetailModal } from './CandidateDetailModal'

const queryClients = new Set<QueryClient>()

function DetailModalWithoutCard() {
  const fallbackFocusRef = useRef<HTMLElement>(null)

  return (
    <>
      <section
        aria-label="채용 단계별 후보자"
        ref={fallbackFocusRef}
        tabIndex={-1}
      />
      <CandidateDetailModal fallbackFocusRef={fallbackFocusRef} />
    </>
  )
}

function renderDetailModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClients.add(queryClient)

  return render(
    <QueryClientProvider client={queryClient}>
      <DetailModalWithoutCard />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  useBoardDetailStore.setState({ selectedCandidateId: null })
  queryClients.forEach((queryClient) => queryClient.clear())
  queryClients.clear()
})

describe('CandidateDetailModal', () => {
  it('원래 카드가 사라졌다면 닫을 때 보드 영역으로 포커스를 복귀시킨다', async () => {
    const user = userEvent.setup()
    const candidate = generateCandidateFixtures({ seed: 33, size: 200 })[0]

    if (!candidate) {
      throw new Error('상세 모달 테스트 후보자를 생성하지 못했습니다.')
    }

    server.use(
      http.get('*/api/candidates/:candidateId', () =>
        HttpResponse.json({ data: candidate }),
      ),
    )
    useBoardDetailStore.setState({ selectedCandidateId: candidate.id })
    renderDetailModal()

    expect(
      await screen.findByRole('dialog', { name: '후보자 상세' }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(
        screen.getByRole('region', { name: '채용 단계별 후보자' }),
      ).toHaveFocus()
    })
  })
})
