import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/ui/Button'

const meta = {
  title: 'Shared/Button',
  component: Button,
  args: {
    children: '다시 시도',
  },
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
}
