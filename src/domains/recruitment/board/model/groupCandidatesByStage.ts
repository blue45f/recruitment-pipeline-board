import { type Candidate, type CandidateStage } from '../../candidates/model'

export function groupCandidatesByStage(
  candidates: readonly Candidate[],
): Record<CandidateStage, Candidate[]> {
  const groups: Record<CandidateStage, Candidate[]> = {
    document_review: [],
    interview: [],
    offer_discussion: [],
    hired: [],
    rejected: [],
  }

  for (const candidate of candidates) {
    groups[candidate.currentStage].push(candidate)
  }

  return groups
}
