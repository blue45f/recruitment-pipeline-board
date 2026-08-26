import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CANDIDATE_STAGES,
  candidateSchema,
  generateCandidateFixtures,
  generatePerformanceCandidates,
} from './index'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateCandidateFixtures', () => {
  it.each([200, 1_000] as const)(
    '%i명 성능 시나리오를 요청한 크기로 생성한다',
    (size) => {
      expect(generatePerformanceCandidates(size, 42)).toHaveLength(size)
    },
  )

  it('같은 seed에서 후보자 전체와 ID를 동일하게 재현한다', () => {
    const first = generateCandidateFixtures({ seed: 42, size: 200 })
    const second = generateCandidateFixtures({ seed: 42, size: 200 })
    const differentSeed = generateCandidateFixtures({ seed: 43, size: 200 })

    expect(first).toEqual(second)
    expect(first).not.toEqual(differentSeed)
    expect(first[0]?.id).toBe('candidate-0000016-0001')
    expect(first.at(-1)?.id).toBe('candidate-0000016-0200')
  })

  it('난수 전역과 현재 시각에 접근하지 않는다', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now must not be called')
    })

    expect(() =>
      generateCandidateFixtures({ seed: 7, size: 200 }),
    ).not.toThrow()
  })

  it('1,000명의 ID와 이메일을 중복 없이 생성한다', () => {
    const candidates = generateCandidateFixtures({ seed: 77, size: 1_000 })

    expect(new Set(candidates.map(({ id }) => id))).toHaveLength(1_000)
    expect(new Set(candidates.map(({ email }) => email))).toHaveLength(1_000)
  })

  it('생성한 모든 후보자가 스키마와 ISO 지원일을 따른다', () => {
    const candidates = generateCandidateFixtures({ seed: 2026, size: 1_000 })

    for (const candidate of candidates) {
      expect(candidateSchema.safeParse(candidate).success).toBe(true)
      expect(candidate.name).toMatch(/^[가-힣]{2,4}$/)
      expect(new Date(candidate.appliedAt).toISOString()).toBe(
        candidate.appliedAt,
      )
    }
  })

  it('다섯 단계를 1,000명에게 균등하게 분배한다', () => {
    const counts = Object.fromEntries(
      CANDIDATE_STAGES.map((stage) => [stage, 0]),
    ) as Record<(typeof CANDIDATE_STAGES)[number], number>

    for (const candidate of generateCandidateFixtures({
      seed: 2026,
      size: 1_000,
    })) {
      counts[candidate.currentStage] += 1
    }

    expect(counts).toEqual(
      Object.fromEntries(CANDIDATE_STAGES.map((stage) => [stage, 200])),
    )
  })

  it('빈 상태 fixture도 같은 계약으로 생성한다', () => {
    expect(generateCandidateFixtures({ seed: 1, size: 0 })).toEqual([])
  })

  it('32비트 범위를 벗어난 seed를 거부한다', () => {
    expect(() =>
      generateCandidateFixtures({ seed: 0x1_0000_0000, size: 200 }),
    ).toThrow()
  })
})
