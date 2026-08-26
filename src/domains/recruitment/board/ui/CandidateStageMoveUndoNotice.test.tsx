import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CandidateStageMoveUndoNotice } from './CandidateStageMoveUndoNotice'

const candidateName = '김아주긴이름의프론트엔드지원자'

describe('CandidateStageMoveUndoNotice', () => {
  it('성공한 이동과 한 번의 되돌리기 동작을 안내한다', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(
      <CandidateStageMoveUndoNotice
        candidateName={candidateName}
        fromStage="document_review"
        onAction={onAction}
        status="available"
        toStage="interview"
      />,
    )

    const notice = screen.getByRole('status', {
      name: `${candidateName} 후보자의 단계를 이동했어요`,
    })
    const button = screen.getByRole('button', {
      name: `${candidateName} 후보자를 서류검토 단계로 되돌리기`,
    })

    expect(notice).toHaveTextContent(
      '서류검토에서 면접 단계로 이동했습니다. 필요하면 한 번 되돌릴 수 있습니다.',
    )
    expect(notice).not.toHaveAttribute('aria-live')
    expect(screen.getByRole('heading')).toHaveClass(
      'break-words',
      '[overflow-wrap:anywhere]',
    )
    expect(button).toHaveClass('min-h-11', 'w-full', 'sm:w-auto')

    await user.click(button)

    expect(onAction).toHaveBeenCalledExactlyOnceWith('pointer')
  })

  it('되돌리는 동안 버튼을 비활성화하고 진행 상태를 전달한다', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(
      <CandidateStageMoveUndoNotice
        candidateName={candidateName}
        fromStage="document_review"
        onAction={onAction}
        status="pending"
        toStage="interview"
      />,
    )

    const button = screen.getByRole('button', {
      name: `${candidateName} 후보자를 서류검토 단계로 되돌리는 중`,
    })

    expect(
      screen.getByRole('status', {
        name: `${candidateName} 후보자의 단계를 되돌리고 있어요`,
      }),
    ).toHaveTextContent('면접에서 서류검토 단계로 되돌리는 중입니다.')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveTextContent('되돌리는 중')

    await user.click(button)

    expect(onAction).not.toHaveBeenCalled()
  })

  it('실패하면 실제 유지 단계와 안전한 문구를 알리고 재시도한다', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(
      <CandidateStageMoveUndoNotice
        candidateName={candidateName}
        fromStage="document_review"
        onAction={onAction}
        safeMessage="서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요."
        status="failure"
        toStage="interview"
      />,
    )

    const notice = screen.getByRole('alert', {
      name: `${candidateName} 후보자의 단계를 되돌리지 못했어요`,
    })
    const button = screen.getByRole('button', {
      name: `${candidateName} 후보자를 서류검토 단계로 되돌리기 다시 시도`,
    })

    expect(notice).toHaveTextContent(
      `${candidateName} 후보자는 면접 단계에 유지됩니다.`,
    )
    expect(notice).toHaveTextContent(
      '서버가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.',
    )

    await user.click(button)

    expect(onAction).toHaveBeenCalledExactlyOnceWith('pointer')
  })

  it('결과가 불명확하면 키보드로 상태를 다시 확인할 수 있다', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(
      <CandidateStageMoveUndoNotice
        candidateName={candidateName}
        fromStage="document_review"
        onAction={onAction}
        safeMessage="네트워크 연결을 확인해 주세요."
        status="verification-required"
        toStage="interview"
      />,
    )

    const notice = screen.getByRole('alert', {
      name: `${candidateName} 후보자의 되돌리기 결과를 확인해 주세요`,
    })
    const button = screen.getByRole('button', {
      name: `${candidateName} 후보자의 서류검토 단계 되돌리기 상태 다시 확인`,
    })

    expect(notice).toHaveTextContent(
      '서류검토 단계로 되돌린 결과가 아직 확정되지 않았습니다.',
    )
    expect(notice).toHaveTextContent('네트워크 연결을 확인해 주세요.')

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onAction).toHaveBeenCalledExactlyOnceWith('keyboard')
  })
})
