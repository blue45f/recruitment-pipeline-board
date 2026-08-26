import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { delay, http, HttpResponse } from 'msw'
import { useEffect, useRef, useState } from 'react'
import { fn } from 'storybook/test'

import {
  generateCandidateFixtures,
  type Candidate,
} from '@/domains/recruitment/candidates/model'
import { candidateQueryKeys } from '@/domains/recruitment/candidates/query'

import { groupCandidatesByStage, useBoardDetailStore } from '../model'
import { CandidateBoardView } from './CandidateBoardView'
import { CandidateDetailModal } from './CandidateDetailModal'

const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
const candidate = candidates[0]

if (!candidate) {
  throw new Error('상세 모달 Story 후보자를 생성하지 못했습니다.')
}

const openCandidate = fn()

function DetailModalFrame({ candidate }: Readonly<{ candidate: Candidate }>) {
  const fallbackFocusRef = useRef<HTMLElement>(null)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
      }),
  )

  useEffect(() => {
    queryClient.setQueryData(candidateQueryKeys.list(200), {
      data: candidates,
      meta: { total: candidates.length },
    })
    useBoardDetailStore.getState().openCandidate(candidate.id)

    return () => {
      useBoardDetailStore.getState().closeCandidate()
      queryClient.clear()
    }
  }, [candidate.id, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-svh bg-[var(--color-fog)] p-5">
        <section
          aria-label="상세 모달 Story 보드"
          ref={fallbackFocusRef}
          tabIndex={-1}
        >
          <CandidateBoardView
            candidatesByStage={groupCandidatesByStage(candidates)}
            onOpenCandidate={openCandidate}
          />
        </section>
        <CandidateDetailModal fallbackFocusRef={fallbackFocusRef} />
      </main>
    </QueryClientProvider>
  )
}

const meta = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <DetailModalFrame candidate={candidate} />,
  title: 'Recruitment/Candidate detail modal',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/candidates/:candidateId', async () => {
          await delay(350)
          return HttpResponse.json({ data: candidate })
        }),
      ],
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/candidates/:candidateId', async () => {
          await delay('infinite')
          return HttpResponse.json({ data: candidate })
        }),
      ],
    },
  },
}

export const RetryableError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/candidates/:candidateId', () =>
          HttpResponse.json(
            { message: 'internal storybook server detail' },
            { status: 503 },
          ),
        ),
      ],
    },
  },
}

export const NotFound: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/candidates/:candidateId', () =>
          HttpResponse.json(
            { message: 'internal storybook candidate lookup' },
            { status: 404 },
          ),
        ),
      ],
    },
  },
}
