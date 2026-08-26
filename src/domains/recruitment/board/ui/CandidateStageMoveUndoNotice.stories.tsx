import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CandidateStageMoveUndoNotice } from './CandidateStageMoveUndoNotice'

const meta = {
  args: {
    candidateName: '김지원',
    fromStage: 'document_review',
    onAction: fn(),
    status: 'available',
    toStage: 'interview',
  },
  component: CandidateStageMoveUndoNotice,
  decorators: [
    (Story) => (
      <main className="w-[min(42rem,calc(100vw-2rem))] bg-[var(--color-fog)] p-4">
        <Story />
      </main>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  title: 'Recruitment/Candidate stage move undo notice',
} satisfies Meta<typeof CandidateStageMoveUndoNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {}

export const Pending: Story = {
  args: {
    status: 'pending',
  },
}

export const Failed: Story = {
  args: {
    safeMessage: '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
    status: 'failure',
  },
}

export const VerificationRequired: Story = {
  args: {
    safeMessage: '네트워크 연결을 확인해 주세요.',
    status: 'verification-required',
  },
}

export const LongCandidateName: Story = {
  args: {
    candidateName: '김아주긴이름의프론트엔드엔지니어지원자',
    fromStage: 'rejected',
    toStage: 'offer_discussion',
  },
}
