import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CANDIDATE_ROLE_LABELS,
  CANDIDATE_STAGE_LABELS,
  generateCandidateFixtures,
} from '@/domains/recruitment/candidates/model'

import { CandidateDragOverlay } from './CandidateDragOverlay'
import {
  CANDIDATE_DRAG_TYPE,
  CANDIDATE_STAGE_DROP_TYPE,
} from './candidateDragAndDrop'

const { useDragOperationMock } = vi.hoisted(() => ({
  useDragOperationMock: vi.fn(),
}))

vi.mock('@dnd-kit/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dnd-kit/react')>()

  return {
    ...original,
    useDragOperation: useDragOperationMock,
  }
})

const generatedCandidate = generateCandidateFixtures({ seed: 42, size: 200 })[0]

if (generatedCandidate === undefined) {
  throw new Error('드래그 overlay를 검증할 후보자를 생성하지 못했습니다.')
}

const candidate = {
  ...generatedCandidate,
  currentStage: 'document_review' as const,
}

describe('CandidateDragOverlay', () => {
  beforeEach(() => {
    useDragOperationMock.mockReset()
  })

  it('출발 후보자가 없으면 overlay를 표시하지 않는다', () => {
    useDragOperationMock.mockReturnValue({ source: null, target: null })

    const { container } = render(<CandidateDragOverlay />)

    expect(container).toBeEmptyDOMElement()
  })

  it('후보자와 현재 목적 단계를 비대화형 이동 요약으로 표시한다', () => {
    useDragOperationMock.mockReturnValue({
      source: {
        data: { candidate, kind: CANDIDATE_DRAG_TYPE },
      },
      target: {
        data: { kind: CANDIDATE_STAGE_DROP_TYPE, stage: 'interview' },
      },
    })

    render(<CandidateDragOverlay />)
    const overlay = screen.getByTestId('candidate-drag-overlay')

    expect(overlay).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(candidate.name)).toBeInTheDocument()
    expect(
      screen.getByText(CANDIDATE_ROLE_LABELS[candidate.role]),
    ).toBeInTheDocument()
    expect(
      screen.getByText(CANDIDATE_STAGE_LABELS.document_review),
    ).toBeInTheDocument()
    expect(
      screen.getByText(CANDIDATE_STAGE_LABELS.interview),
    ).toBeInTheDocument()
  })

  it('아직 목적 단계가 없으면 선택 중인 상태를 표시한다', () => {
    useDragOperationMock.mockReturnValue({
      source: {
        data: { candidate, kind: CANDIDATE_DRAG_TYPE },
      },
      target: null,
    })

    render(<CandidateDragOverlay />)

    expect(screen.getByText('단계 선택 중')).toBeInTheDocument()
  })

  it('출발 데이터가 계약과 다르면 overlay를 표시하지 않는다', () => {
    useDragOperationMock.mockReturnValue({
      source: { data: { candidate, kind: 'candidate-with-typo' } },
      target: null,
    })

    const { container } = render(<CandidateDragOverlay />)

    expect(container).toBeEmptyDOMElement()
  })
})
