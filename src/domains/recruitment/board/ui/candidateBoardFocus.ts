import type { CandidateId } from '@/domains/recruitment/candidates/model'

export type CandidateBoardFocusRequest = Readonly<{
  candidateId: CandidateId
  requestId: number
}>
