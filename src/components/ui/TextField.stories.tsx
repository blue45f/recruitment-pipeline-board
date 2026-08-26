import type { Meta, StoryObj } from '@storybook/react-vite'

import { TextField } from '@/components/ui/TextField'

const meta = {
  title: 'Shared/TextField',
  component: TextField,
  args: {
    label: '후보자 검색',
    name: 'candidate-search',
    placeholder: '이름을 입력하세요',
  },
  decorators: [
    (Story) => (
      <div className="w-[min(24rem,calc(100vw-2rem))]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDescription: Story = {
  args: {
    description: '이름 일부만 입력해도 검색할 수 있습니다.',
  },
}

export const WithError: Story = {
  args: {
    defaultValue: '123',
    error: '이름에는 문자를 입력해 주세요.',
  },
}

export const Disabled: Story = {
  args: {
    defaultValue: '김토스',
    disabled: true,
  },
}
