import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { SelectField } from '@/components/ui/SelectField'

const roleOptions = [
  { label: '전체 직무', value: 'all' },
  { label: '프론트엔드 개발자', value: 'frontend' },
  { label: '프로덕트 디자이너', value: 'designer' },
]

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

describe('SelectField', () => {
  it('필드 레이블과 현재 선택 값을 이름과 값으로 구분한다', () => {
    render(
      <SelectField
        defaultValue="all"
        label="직무"
        name="role"
        options={roleOptions}
      />,
    )

    expect(screen.getByRole('combobox', { name: '직무' })).toHaveTextContent(
      '전체 직무',
    )
  })

  it('키보드로 다음 항목을 선택하고 변경 값을 전달한다', async () => {
    const user = userEvent.setup()
    const handleValueChange = vi.fn()

    render(
      <SelectField
        defaultValue="all"
        label="직무"
        name="role"
        onValueChange={handleValueChange}
        options={roleOptions}
      />,
    )

    const trigger = screen.getByRole('combobox', { name: '직무' })
    trigger.focus()
    await user.keyboard(' ')
    await screen.findByRole('option', { name: '전체 직무' })
    await user.keyboard('{ArrowDown}{Enter}')

    expect(handleValueChange).toHaveBeenCalledWith('frontend')
    expect(trigger).toHaveTextContent('프론트엔드 개발자')
    expect(trigger).toHaveAccessibleName('직무')
    expect(trigger).toHaveFocus()
  })

  it('설명과 오류를 선택 버튼에 연결하고 오류를 알린다', () => {
    render(
      <SelectField
        description="지원 직무를 기준으로 목록을 좁힙니다."
        error="직무를 다시 선택해 주세요."
        label="직무"
        name="role"
        options={roleOptions}
      />,
    )

    const trigger = screen.getByRole('combobox', { name: '직무' })

    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAccessibleDescription(
      '지원 직무를 기준으로 목록을 좁힙니다. 직무를 다시 선택해 주세요.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      '직무를 다시 선택해 주세요.',
    )
  })
})
