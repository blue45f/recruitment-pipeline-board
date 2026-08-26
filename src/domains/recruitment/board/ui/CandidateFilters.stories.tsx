import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import {
  DEFAULT_CANDIDATE_FILTERS,
  type CandidateFilters as CandidateFilterValues,
} from '../model'
import { CandidateFilters } from './CandidateFilters'

const meta = {
  component: CandidateFilters,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Recruitment/Candidate filters',
} satisfies Meta<typeof CandidateFilters>

export default meta
type Story = StoryObj<typeof meta>

function ControlledFilters() {
  const [filters, setFilters] = useState<CandidateFilterValues>(
    DEFAULT_CANDIDATE_FILTERS,
  )

  return (
    <main className="min-h-svh bg-[var(--color-fog)] p-5">
      <CandidateFilters filters={filters} onFiltersChange={setFilters} />
    </main>
  )
}

export const Default: Story = {
  args: {
    filters: DEFAULT_CANDIDATE_FILTERS,
    onFiltersChange: () => undefined,
  },
  render: () => <ControlledFilters />,
}
