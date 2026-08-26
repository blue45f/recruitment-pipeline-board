import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
})
