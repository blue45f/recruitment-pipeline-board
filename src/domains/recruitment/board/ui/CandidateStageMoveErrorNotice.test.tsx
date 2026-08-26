import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { generateCandidateFixtures } from '@/domains/recruitment/candidates/model'

import type { CandidateStageMoveVerificationRequired } from '../model'
import { CandidateStageMoveVerificationNotice } from './CandidateStageMoveErrorNotice'

const candidate = generateCandidateFixtures({ seed: 20260827, size: 200 })[0]

if (candidate === undefined) {
  throw new Error('후보자 fixture를 만들지 못했습니다.')
}

const intent = {
  candidateId: candidate.id,
  candidateName: candidate.name,
  targetStage: 'interview' as const,
}

const verification: CandidateStageMoveVerificationRequired = {
  attemptedCommand: {
    candidateId: candidate.id,
    clientMutationId: 'verification-notice-mutation',
    expectedRevision: candidate.revision,
    targetStage: 'interview',
  },
  attemptedIntent: intent,
  candidateId: candidate.id,
  candidateName: candidate.name,
  completedAt: Date.parse('2026-08-27T05:00:00.000Z'),
  intent,
  intentOrder: 1,
  projectedStage: 'interview',
  safeMessage: '네트워크 연결을 확인해 주세요.',
  status: 'verification-required',
}

describe('CandidateStageMoveVerificationNotice', () => {
  it('다시 확인하는 동안 진행 상태를 알리고 중복 입력을 막는다', () => {
    render(
      <CandidateStageMoveVerificationNotice
        isVerifying
        onVerify={vi.fn()}
        verification={verification}
      />,
    )

    const button = screen.getByRole('button', {
      name: `${candidate.name} 후보자 면접 단계 이동 상태 확인 중`,
    })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveTextContent('확인 중')
  })

  it('대기 중이 아니면 상태를 다시 확인할 수 있다', async () => {
    const user = userEvent.setup()
    const onVerify = vi.fn()

    render(
      <CandidateStageMoveVerificationNotice
        onVerify={onVerify}
        verification={verification}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `${candidate.name} 후보자 면접 단계 이동 상태 다시 확인`,
      }),
    )

    expect(onVerify).toHaveBeenCalledOnce()
  })
})
