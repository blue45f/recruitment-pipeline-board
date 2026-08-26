import { createRef } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type {
  Candidate,
  CandidateStage,
} from '@/domains/recruitment/candidates/model'

import { CandidateStageChangeDialog } from './CandidateStageChangeDialog'

const candidate: Candidate = {
  id: 'candidate-stage-dialog',
  name: '김이동',
  role: 'frontend_engineer',
  appliedAt: '2026-08-20T00:00:00.000Z',
  currentStage: 'document_review',
  email: 'move-dialog@example.com',
  experienceYears: 5,
  memo: '단계 변경 다이얼로그 테스트',
  stageChangedAt: '2026-08-20T00:00:00.000Z',
  revision: 1,
}

type MoveCandidate = (sourceCandidate: Candidate, stage: CandidateStage) => void

function renderDialog(onMoveCandidate: MoveCandidate) {
  const fallbackFocusRef = createRef<HTMLElement>()
  const onClose = vi.fn()

  render(
    <>
      <section ref={fallbackFocusRef} tabIndex={-1} />
      <CandidateStageChangeDialog
        candidate={candidate}
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
        onMoveCandidate={onMoveCandidate}
      />
    </>,
  )

  return { onClose }
}

describe('CandidateStageChangeDialog', () => {
  it('현재 단계를 제외한 네 목적 단계와 유효성 오류를 제공한다', async () => {
    const user = userEvent.setup()
    const onMoveCandidate = vi.fn<MoveCandidate>()

    renderDialog(onMoveCandidate)

    const dialog = screen.getByRole('dialog', {
      name: '김이동 후보자 단계 변경',
    })

    expect(within(dialog).getAllByRole('radio')).toHaveLength(4)
    expect(
      within(dialog).queryByRole('radio', { name: '서류검토' }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: '면접' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: '변경하기' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '이동할 단계를 선택해 주세요.',
    )
    expect(onMoveCandidate).not.toHaveBeenCalled()
  })

  it('키보드로 목적 단계를 선택하면 이동을 접수하고 바로 닫는다', async () => {
    const user = userEvent.setup()
    const onMoveCandidate = vi.fn<MoveCandidate>()
    const { onClose } = renderDialog(onMoveCandidate)
    const interview = screen.getByRole('radio', { name: '면접' })

    interview.focus()
    await user.keyboard(' ')
    await user.click(screen.getByRole('button', { name: '변경하기' }))

    expect(onMoveCandidate).toHaveBeenCalledExactlyOnceWith(
      candidate,
      'interview',
    )
    expect(onClose).toHaveBeenCalledOnce()
  })
})
