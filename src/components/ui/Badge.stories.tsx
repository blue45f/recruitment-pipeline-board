import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '@/components/ui/Badge'

const meta = {
  title: 'Shared/Badge',
  component: Badge,
  args: {
    children: '서류검토',
  },
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {}

export const Info: Story = {
  args: {
    children: '면접',
    tone: 'info',
  },
}

export const Attention: Story = {
  args: {
    children: '처우협의',
    tone: 'attention',
  },
}

export const Success: Story = {
  args: {
    children: '최종합격',
    tone: 'success',
  },
}

export const Danger: Story = {
  args: {
    children: '불합격',
    tone: 'danger',
  },
}
