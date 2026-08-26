import type { Meta, StoryObj } from '@storybook/react-vite'

import { generateCandidateFixtures } from '@/domains/recruitment/candidates/model'

import { CandidateDetailView } from './CandidateDetailView'

const candidate = generateCandidateFixtures({ seed: 9, size: 200 })[0]

if (!candidate) {
  throw new Error('상세 Story 후보자를 생성하지 못했습니다.')
}

const meta = {
  component: CandidateDetailView,
  parameters: {
    layout: 'centered',
  },
  title: 'Recruitment/Candidate detail',
} satisfies Meta<typeof CandidateDetailView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { candidate },
  render: (args) => (
    <main className="w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-[var(--shadow-panel)]">
      <CandidateDetailView {...args} />
    </main>
  ),
}

export const LongContent: Story = {
  args: {
    candidate: {
      ...candidate,
      email: `${'long-address-'.repeat(14)}candidate@example.test`,
      memo: `https://example.test/${'very-long-unbroken-note-'.repeat(19)}`,
      name: '긴이름후보자'.repeat(8).slice(0, 50),
    },
  },
  render: (args) => (
    <main className="w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-[var(--shadow-panel)]">
      <CandidateDetailView {...args} />
    </main>
  ),
}
