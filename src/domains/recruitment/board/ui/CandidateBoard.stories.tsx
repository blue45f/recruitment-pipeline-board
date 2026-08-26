import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { generateCandidateFixtures } from '@/domains/recruitment/candidates/model'

import { groupCandidatesByStage } from '../model'
import { CandidateBoardView } from './CandidateBoardView'

const candidates = generateCandidateFixtures({ seed: 42, size: 200 })

const meta = {
  component: CandidateBoardView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Recruitment/Candidate list',
} satisfies Meta<typeof CandidateBoardView>

export default meta
type Story = StoryObj<typeof meta>

export const TwoHundredCandidates: Story = {
  args: {
    candidatesByStage: groupCandidatesByStage(candidates),
    onOpenCandidate: fn(),
    onPrefetchCandidate: fn(),
  },
  render: (args) => (
    <main className="min-h-svh bg-[var(--color-fog)] p-5">
      <CandidateBoardView {...args} />
    </main>
  ),
}
