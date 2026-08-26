import { describe, expect, it } from 'vitest'

import { createCandidateStageChangeFormSchema } from './candidateStageChangeForm'

describe('candidate stage change form', () => {
  const schema = createCandidateStageChangeFormSchema('interview')

  it('현재 단계가 아닌 유효한 목적 단계를 허용한다', () => {
    expect(schema.parse({ stage: 'offer_discussion' })).toEqual({
      stage: 'offer_discussion',
    })
  })

  it('현재 단계와 알 수 없는 단계를 구분해 안내한다', () => {
    const currentStageResult = schema.safeParse({ stage: 'interview' })
    const unknownStageResult = schema.safeParse({ stage: 'unknown' })

    expect(currentStageResult.error?.issues[0]?.message).toBe(
      '현재 단계가 아닌 다른 단계를 선택해 주세요.',
    )
    expect(unknownStageResult.error?.issues[0]?.message).toBe(
      '이동할 단계를 선택해 주세요.',
    )
  })

  it('목적 단계를 선택하지 않으면 필요한 행동을 안내한다', () => {
    const result = schema.safeParse({})

    expect(result.error?.issues[0]?.message).toBe(
      '이동할 단계를 선택해 주세요.',
    )
  })
})
