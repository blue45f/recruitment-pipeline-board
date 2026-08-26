import type { Meta, StoryObj } from '@storybook/react-vite'
import { SlidersHorizontal } from 'lucide-react'
import { Tooltip as RadixTooltip } from 'radix-ui'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

const meta = {
  title: 'Shared/Tooltip',
  component: Tooltip,
  args: {
    children: (
      <Button aria-label="필터 설정" size="icon" variant="secondary">
        <SlidersHorizontal aria-hidden="true" />
      </Button>
    ),
    content: '필터 설정',
  },
  decorators: [
    (Story) => (
      <RadixTooltip.Provider delayDuration={0}>
        <Story />
      </RadixTooltip.Provider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
