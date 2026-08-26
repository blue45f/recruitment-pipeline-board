import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

const meta = {
  title: 'Shared/Modal',
  component: Modal,
  args: {
    children: (
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-[var(--color-muted)]">지원 직무</dt>
          <dd className="mt-1 font-semibold">프론트엔드 개발자</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">현재 단계</dt>
          <dd className="mt-1">
            <Badge tone="info">면접</Badge>
          </dd>
        </div>
      </dl>
    ),
    description: '후보자의 지원 정보와 현재 채용 단계를 확인합니다.',
    footer: <Button variant="secondary">확인</Button>,
    title: '김토스 후보자',
    trigger: <Button>상세 보기</Button>,
  },
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InitiallyOpen: Story = {
  args: {
    defaultOpen: true,
  },
}
