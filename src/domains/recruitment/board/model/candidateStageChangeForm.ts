import { z } from 'zod'

import {
  CANDIDATE_STAGES,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'

export function createCandidateStageChangeFormSchema(
  currentStage: CandidateStage,
) {
  return z
    .object({
      stage: z.enum(CANDIDATE_STAGES, {
        error: '이동할 단계를 선택해 주세요.',
      }),
    })
    .strict()
    .refine(({ stage }) => stage !== currentStage, {
      message: '현재 단계가 아닌 다른 단계를 선택해 주세요.',
      path: ['stage'],
    })
}

export type CandidateStageChangeFormValues = z.infer<
  ReturnType<typeof createCandidateStageChangeFormSchema>
>
