import type { CandidateId, CandidateListSize } from '../model'

export const candidateQueryKeys = {
  all: ['recruitment', 'candidates'] as const,
  details: () => [...candidateQueryKeys.all, 'detail'] as const,
  detail: (candidateId: CandidateId) =>
    [...candidateQueryKeys.details(), candidateId] as const,
  lists: () => [...candidateQueryKeys.all, 'list'] as const,
  list: (size: CandidateListSize) =>
    [...candidateQueryKeys.lists(), size] as const,
  stageUpdates: () => [...candidateQueryKeys.all, 'stage-update'] as const,
}
