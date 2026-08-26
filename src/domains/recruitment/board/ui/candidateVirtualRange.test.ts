import { describe, expect, it } from 'vitest'

import { extractRangeWithPinnedCandidates } from './candidateVirtualRange'

const visibleRange = {
  count: 200,
  endIndex: 43,
  overscan: 3,
  startIndex: 40,
}

describe('extractRangeWithPinnedCandidates', () => {
  it('가시 범위 밖의 활성 후보자와 드래그 후보자를 함께 유지한다', () => {
    expect(
      extractRangeWithPinnedCandidates(visibleRange, [0, 199, 40, -1]),
    ).toEqual([0, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 199])
  })

  it('중복되거나 이미 보이는 후보자는 한 번만 렌더링한다', () => {
    expect(
      extractRangeWithPinnedCandidates(visibleRange, [40, 40, 43, -1]),
    ).toEqual([37, 38, 39, 40, 41, 42, 43, 44, 45, 46])
  })
})
