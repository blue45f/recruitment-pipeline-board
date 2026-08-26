import { z } from 'zod'

import { candidateSchema, type Candidate } from './candidate'
import { CANDIDATE_ROLES } from './candidateRole'
import {
  candidateListSizeSchema,
  type CandidateListSize,
} from './candidateContracts'
import { CANDIDATE_STAGES } from './candidateStage'

export const candidateFixtureOptionsSchema = z
  .object({
    seed: z.number().int().min(0).max(0xffff_ffff),
    size: candidateListSizeSchema,
  })
  .strict()

export type CandidateFixtureOptions = z.infer<
  typeof candidateFixtureOptionsSchema
>

const FAMILY_NAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
  '황',
  '안',
  '송',
  '류',
  '홍',
] as const

const GIVEN_NAMES = [
  '민준',
  '서준',
  '도윤',
  '예준',
  '시우',
  '주원',
  '하준',
  '지호',
  '지훈',
  '준서',
  '서연',
  '서윤',
  '지우',
  '서현',
  '민서',
  '하윤',
  '하은',
  '지유',
  '윤서',
  '지민',
  '예은',
  '수빈',
  '민지',
  '은서',
  '지아',
  '현우',
  '준혁',
  '지은',
  '수현',
  '유진',
  '혜진',
  '다은',
  '성현',
  '수민',
  '채원',
  '주현',
  '예린',
  '태현',
  '아영',
  '동현',
] as const

const CANDIDATE_MEMOS = [
  '협업 과정에서 문제를 구조적으로 정리하는 강점이 있습니다.',
  '사용자 관점에서 개선 지점을 찾은 경험을 확인했습니다.',
  '복잡한 요구사항을 작은 단위로 나누어 실행합니다.',
  '동료와 피드백을 주고받는 과정을 중요하게 생각합니다.',
  '지원 직무와 연결되는 프로젝트 경험이 인상적입니다.',
  '면접에서 최근 프로젝트의 의사결정 과정을 확인할 예정입니다.',
] as const

const REFERENCE_TIME = Date.UTC(2026, 7, 1, 9, 0, 0)
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function randomIndex(random: () => number, length: number) {
  return Math.floor(random() * length)
}

function normalizedOffset(seed: number, length: number) {
  return (seed >>> 0) % length
}

function candidateId(seed: number, index: number) {
  const seedPart = (seed >>> 0).toString(36).padStart(7, '0')
  const indexPart = String(index + 1).padStart(4, '0')

  return `candidate-${seedPart}-${indexPart}`
}

export function generateCandidateFixtures(
  rawOptions: CandidateFixtureOptions,
): Candidate[] {
  const { seed, size } = candidateFixtureOptionsSchema.parse(rawOptions)
  const random = createSeededRandom(seed)
  const stageOffset = normalizedOffset(seed, CANDIDATE_STAGES.length)
  const roleOffset = normalizedOffset(seed, CANDIDATE_ROLES.length)

  return Array.from({ length: size }, (_, index) => {
    const appliedDaysAgo = randomIndex(random, 540)
    const appliedMinutesAgo = randomIndex(random, 24 * 60)
    const appliedAtTime =
      REFERENCE_TIME -
      appliedDaysAgo * DAY_IN_MILLISECONDS -
      appliedMinutesAgo * 60_000
    const elapsedDays = Math.max(
      0,
      Math.floor((REFERENCE_TIME - appliedAtTime) / DAY_IN_MILLISECONDS),
    )
    const stageChangedAtTime =
      appliedAtTime + randomIndex(random, elapsedDays + 1) * DAY_IN_MILLISECONDS
    const id = candidateId(seed, index)

    return candidateSchema.parse({
      id,
      name: `${FAMILY_NAMES[randomIndex(random, FAMILY_NAMES.length)]}${GIVEN_NAMES[randomIndex(random, GIVEN_NAMES.length)]}`,
      role: CANDIDATE_ROLES[(index + roleOffset) % CANDIDATE_ROLES.length],
      appliedAt: new Date(appliedAtTime).toISOString(),
      currentStage:
        CANDIDATE_STAGES[(index + stageOffset) % CANDIDATE_STAGES.length],
      email: `${id}@example.test`,
      experienceYears: randomIndex(random, 16),
      memo: CANDIDATE_MEMOS[randomIndex(random, CANDIDATE_MEMOS.length)],
      stageChangedAt: new Date(stageChangedAtTime).toISOString(),
      revision: randomIndex(random, 6),
    })
  })
}

export function generatePerformanceCandidates(
  size: Exclude<CandidateListSize, 0>,
  seed: number,
) {
  return generateCandidateFixtures({ seed, size })
}
