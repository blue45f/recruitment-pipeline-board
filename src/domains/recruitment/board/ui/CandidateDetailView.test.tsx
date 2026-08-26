import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { generateCandidateFixtures } from '@/domains/recruitment/candidates/model'

import { CandidateDetailView } from './CandidateDetailView'

describe('CandidateDetailView', () => {
  it('후보자의 연락처, 경력, 지원일, 단계와 메모를 표시한다', () => {
    const candidate = generateCandidateFixtures({ seed: 9, size: 200 })[0]

    if (!candidate) {
      throw new Error('테스트 후보자를 생성하지 못했습니다.')
    }

    render(<CandidateDetailView candidate={candidate} />)

    const detail = screen.getByRole('region', {
      name: `${candidate.name} 후보자 상세 정보`,
    })

    expect(
      within(detail).getByRole('link', { name: candidate.email }),
    ).toHaveAttribute('href', `mailto:${candidate.email}`)
    expect(
      within(detail).getByText(`${candidate.experienceYears}년`),
    ).toBeInTheDocument()
    expect(within(detail).getByText('지원일')).toBeInTheDocument()
    expect(within(detail).getAllByText('현재 단계').length).toBeGreaterThan(0)
    expect(within(detail).getByText(candidate.memo)).toBeInTheDocument()
  })

  it('저장 중에도 단계 변경 버튼을 다시 실행할 수 있다', async () => {
    const user = userEvent.setup()
    const candidate = generateCandidateFixtures({ seed: 9, size: 200 })[0]
    const onChangeStage = vi.fn()

    if (!candidate) {
      throw new Error('테스트 후보자를 생성하지 못했습니다.')
    }

    render(
      <CandidateDetailView
        candidate={candidate}
        isStageChangePending
        onChangeStage={onChangeStage}
      />,
    )

    const stageButton = screen.getByRole('button', {
      name: `${candidate.name} 후보자 저장 중 · 변경`,
    })

    expect(stageButton).toBeEnabled()
    expect(stageButton).toHaveAttribute('aria-busy', 'true')

    await user.click(stageButton)

    expect(onChangeStage).toHaveBeenCalledExactlyOnceWith(candidate)
  })
})
