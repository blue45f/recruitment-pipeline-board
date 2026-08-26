import { describe, expect, it } from 'vitest'

import {
  CANDIDATE_STAGES,
  generateCandidateFixtures,
} from '@/domains/recruitment/candidates/model'

import {
  CANDIDATE_DRAG_TYPE,
  CANDIDATE_STAGE_DROP_TYPE,
  candidateDragId,
  candidateStageDropId,
  resolveCandidateStageDrop,
} from './candidateDragAndDrop'

const candidate = generateCandidateFixtures({ seed: 42, size: 200 })[0]

if (candidate === undefined) {
  throw new Error('드래그 이동을 검증할 후보자를 생성하지 못했습니다.')
}

const sourceData = {
  candidate,
  kind: CANDIDATE_DRAG_TYPE,
} as const
const targetStage = CANDIDATE_STAGES.find(
  (stage) => stage !== candidate.currentStage,
)

if (targetStage === undefined) {
  throw new Error('드래그 이동을 검증할 목적 단계를 찾지 못했습니다.')
}

describe('resolveCandidateStageDrop', () => {
  it('후보자와 단계 식별자가 서로 충돌하지 않도록 이름 공간을 분리한다', () => {
    expect(candidateDragId(candidate.id)).toBe(`candidate:${candidate.id}`)
    expect(candidateStageDropId(targetStage)).toBe(
      `candidate-stage:${targetStage}`,
    )
  })

  it('다른 단계에 놓으면 이동할 후보자와 목적 단계를 반환한다', () => {
    expect(
      resolveCandidateStageDrop(sourceData, {
        kind: CANDIDATE_STAGE_DROP_TYPE,
        stage: targetStage,
      }),
    ).toEqual({ candidate, targetStage })
  })

  it.each([
    ['취소된 드래그', sourceData, targetStage, true],
    ['목적 단계가 없는 드래그', sourceData, undefined, false],
    ['현재 단계에 놓은 드래그', sourceData, candidate.currentStage, false],
  ])('%s는 이동 요청을 만들지 않는다', (_, source, stage, canceled) => {
    const target =
      stage === undefined
        ? undefined
        : { kind: CANDIDATE_STAGE_DROP_TYPE, stage }

    expect(resolveCandidateStageDrop(source, target, canceled)).toBeUndefined()
  })

  it.each([
    [
      '누락된 출발 후보자',
      undefined,
      { kind: CANDIDATE_STAGE_DROP_TYPE, stage: targetStage },
    ],
    [
      '출발 후보자',
      { candidate, kind: 'candidate-with-typo' },
      { kind: CANDIDATE_STAGE_DROP_TYPE, stage: targetStage },
    ],
    [
      '불필요한 속성이 있는 출발 후보자',
      { candidate, extra: true, kind: CANDIDATE_DRAG_TYPE },
      { kind: CANDIDATE_STAGE_DROP_TYPE, stage: targetStage },
    ],
    ['목적 단계', sourceData, { kind: CANDIDATE_STAGE_DROP_TYPE }],
    [
      '알 수 없는 목적 단계',
      sourceData,
      { kind: CANDIDATE_STAGE_DROP_TYPE, stage: 'unknown' },
    ],
  ])(
    '%s 데이터가 계약과 다르면 이동 요청을 만들지 않는다',
    (_, source, target) => {
      expect(resolveCandidateStageDrop(source, target)).toBeUndefined()
    },
  )
})
