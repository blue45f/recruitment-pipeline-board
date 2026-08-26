import { describe, expect, it } from 'vitest'

import type {
  Candidate,
  CandidateId,
  CandidateStage,
} from '../../candidates/model'
import { groupCandidatesByStage } from './groupCandidatesByStage'
import {
  projectCandidateStage,
  projectCandidateStages,
} from './candidateStageProjection'

const BASE_CANDIDATE = {
  id: 'candidate-projection-0001',
  name: 'Kim Mina',
  role: 'frontend_engineer',
  appliedAt: '2026-06-01T09:00:00.000Z',
  currentStage: 'document_review',
  email: 'candidate-projection-0001@example.test',
  experienceYears: 5,
  memo: '낙관적 단계 투영 테스트를 위한 메모입니다.',
  stageChangedAt: '2026-06-08T09:00:00.000Z',
  revision: 3,
} as const satisfies Candidate

function candidate(id: CandidateId, stage: CandidateStage): Candidate {
  return {
    ...BASE_CANDIDATE,
    id,
    currentStage: stage,
    email: `${id}@example.test`,
  }
}

describe('candidate stage projection', () => {
  it('투영할 단계가 없거나 현재 단계와 같으면 기존 참조를 유지한다', () => {
    const candidates = [BASE_CANDIDATE]

    expect(projectCandidateStage(BASE_CANDIDATE, new Map())).toBe(
      BASE_CANDIDATE,
    )
    expect(
      projectCandidateStages(
        candidates,
        new Map([[BASE_CANDIDATE.id, BASE_CANDIDATE.currentStage]]),
      ),
    ).toBe(candidates)
  })

  it('대상 후보자의 현재 단계만 바꾸고 확정 응답 필드는 보존한다', () => {
    const unrelatedCandidate = candidate(
      'candidate-projection-0002',
      'interview',
    )
    const candidates = [BASE_CANDIDATE, unrelatedCandidate]

    const projectedCandidates = projectCandidateStages(
      candidates,
      new Map([[BASE_CANDIDATE.id, 'offer_discussion']]),
    )

    expect(projectedCandidates).not.toBe(candidates)
    expect(projectedCandidates[0]).toEqual({
      ...BASE_CANDIDATE,
      currentStage: 'offer_discussion',
    })
    expect(projectedCandidates[0]).not.toBe(BASE_CANDIDATE)
    expect(projectedCandidates[0]?.revision).toBe(BASE_CANDIDATE.revision)
    expect(projectedCandidates[0]?.stageChangedAt).toBe(
      BASE_CANDIDATE.stageChangedAt,
    )
    expect(projectedCandidates[1]).toBe(unrelatedCandidate)
  })

  it('투영 후 그룹화해도 후보자는 목표 단계에 정확히 한 번만 속한다', () => {
    const candidates = [
      BASE_CANDIDATE,
      candidate('candidate-projection-0002', 'interview'),
      candidate('candidate-projection-0003', 'hired'),
    ]
    const projectedCandidates = projectCandidateStages(
      candidates,
      new Map([[BASE_CANDIDATE.id, 'hired']]),
    )

    const groups = groupCandidatesByStage(projectedCandidates)
    const projectedOccurrences = Object.values(groups)
      .flat()
      .filter(({ id }) => id === BASE_CANDIDATE.id)

    expect(groups.document_review).not.toContainEqual(
      expect.objectContaining({ id: BASE_CANDIDATE.id }),
    )
    expect(groups.hired).toContainEqual(
      expect.objectContaining({ id: BASE_CANDIDATE.id }),
    )
    expect(projectedOccurrences).toHaveLength(1)
    expect(Object.values(groups).flat()).toHaveLength(candidates.length)
  })
})
