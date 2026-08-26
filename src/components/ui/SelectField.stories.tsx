import type { Meta, StoryObj } from '@storybook/react-vite'

import { SelectField } from '@/components/ui/SelectField'

const roleOptions = [
  { label: '전체 직무', value: 'all' },
  { label: '프론트엔드 개발자', value: 'frontend' },
  { label: '프로덕트 디자이너', value: 'designer' },
  { label: '데이터 분석가', value: 'data' },
]

const meta = {
  title: 'Shared/SelectField',
  component: SelectField,
  args: {
    label: '직무',
    name: 'role',
    options: roleOptions,
    placeholder: '직무를 선택하세요',
  },
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SelectField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    defaultValue: 'all',
  },
}

export const WithoutSelection: Story = {}

export const Disabled: Story = {
  args: {
    defaultValue: 'frontend',
    disabled: true,
  },
}
