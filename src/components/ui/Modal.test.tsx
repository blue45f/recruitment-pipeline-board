import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

function renderCandidateModal() {
  return render(
    <Modal
      description="후보자의 지원 정보와 현재 단계를 확인합니다."
      footer={<Button variant="secondary">확인</Button>}
      title="김토스 후보자"
      trigger={<Button>상세 보기</Button>}
    >
      <p>프론트엔드 개발자 · 서류검토</p>
    </Modal>,
  )
}

describe('Modal', () => {
  it('열릴 때 이름과 설명을 제공하고 Escape로 닫은 뒤 포커스를 돌려준다', async () => {
    const user = userEvent.setup()
    renderCandidateModal()

    const trigger = screen.getByRole('button', { name: '상세 보기' })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: '김토스 후보자' })
    expect(dialog).toHaveAccessibleDescription(
      '후보자의 지원 정보와 현재 단계를 확인합니다.',
    )

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })
  })

  it('명시적인 닫기 버튼으로 닫을 수 있다', async () => {
    const user = userEvent.setup()
    renderCandidateModal()

    await user.click(screen.getByRole('button', { name: '상세 보기' }))
    await user.click(await screen.findByRole('button', { name: '닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
