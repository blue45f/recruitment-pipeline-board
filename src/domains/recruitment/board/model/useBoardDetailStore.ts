import { create } from 'zustand'

import { candidateIdSchema, type CandidateId } from '../../candidates/model'

type BoardDetailState = {
  closeCandidate: () => void
  openCandidate: (candidateId: CandidateId) => void
  selectedCandidateId: CandidateId | null
}

export const useBoardDetailStore = create<BoardDetailState>((set) => ({
  closeCandidate: () => set({ selectedCandidateId: null }),
  openCandidate: (candidateId) => {
    set({ selectedCandidateId: candidateIdSchema.parse(candidateId) })
  },
  selectedCandidateId: null,
}))
