import { describe, expect, it } from 'vitest'

import type { Candidate } from '../../candidates/model'
import {
  candidateFiltersSchema,
  DEFAULT_CANDIDATE_FILTERS,
  filterCandidates,
  normalizeCandidateQuery,
  readCandidateFilters,
  writeCandidateFilters,
} from './candidateFilters'

const BASE_CANDIDATE = {
  id: 'candidate-filter-0001',
  name: 'Kim Mina',
  role: 'frontend_engineer',
  appliedAt: '2026-06-01T09:00:00.000Z',
  currentStage: 'document_review',
  email: 'candidate-filter-0001@example.test',
  experienceYears: 5,
  memo: '후보자 필터 모델 테스트를 위한 메모입니다.',
  stageChangedAt: '2026-06-08T09:00:00.000Z',
  revision: 1,
} as const satisfies Candidate

function candidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    ...BASE_CANDIDATE,
    id,
    email: `${id}@example.test`,
    ...overrides,
  }
}

describe('candidate filters', () => {
  it('검색어와 직무의 입력 범위를 엄격하게 검증한다', () => {
    expect(candidateFiltersSchema.parse(DEFAULT_CANDIDATE_FILTERS)).toEqual({
      query: '',
      role: 'all',
    })
    expect(
      candidateFiltersSchema.safeParse({ query: '', role: 'unknown' }).success,
    ).toBe(false)
    expect(
      candidateFiltersSchema.safeParse({
        query: '',
        role: 'all',
        unexpected: true,
      }).success,
    ).toBe(false)
    expect(
      candidateFiltersSchema.safeParse({
        query: '가'.repeat(51),
        role: 'all',
      }).success,
    ).toBe(false)
  })

  it('앞뒤 공백과 영문 대소문자를 무시하고 이름과 직무를 함께 적용한다', () => {
    const candidates = [
      candidate('candidate-filter-0001'),
      candidate('candidate-filter-0002', {
        name: 'kim Jisoo',
        role: 'backend_engineer',
      }),
      candidate('candidate-filter-0003', {
        name: 'Park Mina',
        role: 'frontend_engineer',
      }),
    ]

    expect(
      filterCandidates(candidates, {
        query: '  KIM  ',
        role: 'frontend_engineer',
      }).map(({ id }) => id),
    ).toEqual(['candidate-filter-0001'])
  })

  it('잘못된 URL 직무와 관계없이 유효한 검색어를 보존한다', () => {
    const filters = readCandidateFilters(
      new URLSearchParams('query=%EA%B9%80&role=unknown'),
    )

    expect(filters).toEqual({ query: '김', role: 'all' })
  })

  it('기본값은 URL에서 생략하고 적용된 조건만 직렬화한다', () => {
    expect(writeCandidateFilters(DEFAULT_CANDIDATE_FILTERS).toString()).toBe('')
    expect(
      writeCandidateFilters({
        query: '김민',
        role: 'backend_engineer',
      }).toString(),
    ).toBe('query=%EA%B9%80%EB%AF%BC&role=backend_engineer')
  })

  it('공백만 있는 검색어는 URL과 활성 조건에서 기본값으로 다룬다', () => {
    expect(
      readCandidateFilters(new URLSearchParams('query=++&role=all')),
    ).toEqual(DEFAULT_CANDIDATE_FILTERS)
    expect(
      writeCandidateFilters({ query: '   ', role: 'all' }).toString(),
    ).toBe('')
    expect(normalizeCandidateQuery('   김 민 ')).toBe('김 민 ')
  })
})
