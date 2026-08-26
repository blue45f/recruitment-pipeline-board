import { z } from 'zod'

export const CANDIDATE_STAGES = [
  'document_review',
  'interview',
  'offer_discussion',
  'hired',
  'rejected',
] as const

export const candidateStageSchema = z.enum(CANDIDATE_STAGES)

export type CandidateStage = z.infer<typeof candidateStageSchema>

export const CANDIDATE_STAGE_LABELS = {
  document_review: '서류검토',
  interview: '면접',
  offer_discussion: '처우협의',
  hired: '최종합격',
  rejected: '불합격',
} as const satisfies Record<CandidateStage, string>
