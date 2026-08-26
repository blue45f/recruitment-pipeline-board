import type { Meta, StoryObj } from '@storybook/react-vite'

import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

const meta = {
  title: 'Shared/LoadingOverlay',
  component: LoadingOverlay,
  args: {
    children: (
      <div className="p-6">
        <p className="font-semibold text-[var(--color-ink)]">후보자 목록</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          데이터가 준비되면 이 영역에 후보자 카드가 표시됩니다.
        </p>
      </div>
    ),
    label: '후보자 목록을 불러오는 중',
    visible: true,
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-48 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const Visible: Story = {}

export const Hidden: Story = {
  args: {
    visible: false,
  },
}
