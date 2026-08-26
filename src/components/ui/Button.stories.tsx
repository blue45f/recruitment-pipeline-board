import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRight, Plus } from 'lucide-react'

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

export const Ghost: Story = {
  args: {
    children: '필터 초기화',
    variant: 'ghost',
  },
}

export const Danger: Story = {
  args: {
    children: '불합격으로 이동',
    variant: 'danger',
  },
}

export const Small: Story = {
  args: {
    children: '단계 이동',
    size: 'sm',
  },
}

export const Loading: Story = {
  args: {
    children: '변경 저장',
    loading: true,
    loadingLabel: '변경 사항을 저장하는 중',
  },
}

export const Icon: Story = {
  args: {
    'aria-label': '후보자 추가',
    children: <Plus aria-hidden="true" />,
    size: 'icon',
    variant: 'secondary',
  },
}

export const AsLink: Story = {
  args: {
    asChild: true,
    children: (
      <a href="#candidate-list">
        후보자 목록
        <ArrowRight aria-hidden="true" />
      </a>
    ),
  },
}
