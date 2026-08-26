import { afterEach, describe, expect, it } from 'vitest'

import type { CandidateId } from '../../candidates/model'
import { useBoardDetailStore } from './useBoardDetailStore'

afterEach(() => {
  useBoardDetailStore.setState({ selectedCandidateId: null })
})

describe('useBoardDetailStore', () => {
  it('상세로 연 후보자 ID를 보관하고 닫을 때 비운다', () => {
    useBoardDetailStore.getState().openCandidate('candidate-detail-1')

    expect(useBoardDetailStore.getState().selectedCandidateId).toBe(
      'candidate-detail-1',
    )

    useBoardDetailStore.getState().closeCandidate()

    expect(useBoardDetailStore.getState().selectedCandidateId).toBeNull()
  })

  it('계약에 맞지 않는 후보자 ID는 상태에 저장하지 않는다', () => {
    expect(() =>
      useBoardDetailStore
        .getState()
        .openCandidate('invalid candidate id' as CandidateId),
    ).toThrow()
    expect(useBoardDetailStore.getState().selectedCandidateId).toBeNull()
  })
})
