import type { Meta, StoryObj } from '@storybook/react-vite'

import { CandidateBoardView } from './CandidateBoardView'

const meta = {
  component: CandidateBoardView,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Recruitment/Board layout',
} satisfies Meta<typeof CandidateBoardView>

export default meta
type Story = StoryObj<typeof meta>

export const FiveStages: Story = {
  render: () => (
    <main className="min-h-svh bg-[var(--color-fog)] p-5">
      <CandidateBoardView />
    </main>
  ),
}
