import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ApiError } from '@/domains/recruitment/candidates/api'

import { BoardErrorFallback } from './BoardErrorFallback'
import { CandidateBoardSkeleton } from './CandidateBoardSkeleton'
import { CandidateEmptyState } from './CandidateEmptyState'

const meta = {
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Recruitment/Board feedback',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const retryBoard = fn()

function FeedbackFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="min-h-svh bg-[var(--color-fog)] p-5">{children}</main>
}

export const Loading: Story = {
  render: () => (
    <FeedbackFrame>
      <CandidateBoardSkeleton />
    </FeedbackFrame>
  ),
}

export const Empty: Story = {
  render: () => (
    <FeedbackFrame>
      <CandidateEmptyState />
    </FeedbackFrame>
  ),
}

export const Failed: Story = {
  render: () => (
    <FeedbackFrame>
      <BoardErrorFallback
        error={
          new ApiError({
            cause: undefined,
            kind: 'http',
            requestId: 'storybook-request',
            retryable: true,
            safeMessage:
              '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
            status: 503,
          })
        }
        onRetry={retryBoard}
      />
    </FeedbackFrame>
  ),
}
