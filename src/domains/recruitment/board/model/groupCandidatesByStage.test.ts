import { describe, expect, it } from 'vitest'

import {
  CANDIDATE_STAGES,
  generateCandidateFixtures,
} from '../../candidates/model'
import { groupCandidatesByStage } from './groupCandidatesByStage'

describe('groupCandidatesByStage', () => {
  it('후보자가 없어도 다섯 단계 키를 정해진 순서로 만든다', () => {
    const groups = groupCandidatesByStage([])

    expect(Object.keys(groups)).toEqual(CANDIDATE_STAGES)
    expect(
      Object.values(groups).every((candidates) => candidates.length === 0),
    ).toBe(true)
  })

  it('후보자를 현재 단계별로 나누고 원래 순서를 보존한다', () => {
    const candidates = generateCandidateFixtures({ seed: 42, size: 200 })
    const groups = groupCandidatesByStage(candidates)

    expect(Object.values(groups).flat()).toHaveLength(200)
    for (const stage of CANDIDATE_STAGES) {
      expect(
        groups[stage].every((candidate) => candidate.currentStage === stage),
      ).toBe(true)
      expect(groups[stage].map(({ id }) => id)).toEqual(
        candidates
          .filter((candidate) => candidate.currentStage === stage)
          .map(({ id }) => id),
      )
    }
  })
})
