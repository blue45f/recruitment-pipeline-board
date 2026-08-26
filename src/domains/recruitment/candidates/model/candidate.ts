import { z } from 'zod'

import { candidateRoleSchema } from './candidateRole'
import { candidateStageSchema } from './candidateStage'

export const candidateIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)

export type CandidateId = z.infer<typeof candidateIdSchema>

const isoDateTimeSchema = z.iso.datetime({ offset: true })

export const candidateSchema = z
  .object({
    id: candidateIdSchema,
    name: z.string().trim().min(1).max(50),
    role: candidateRoleSchema,
    appliedAt: isoDateTimeSchema,
    currentStage: candidateStageSchema,
    email: z.email().max(254),
    experienceYears: z.number().int().nonnegative().max(50),
    memo: z.string().trim().min(1).max(500),
    stageChangedAt: isoDateTimeSchema,
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (
      Date.parse(candidate.stageChangedAt) < Date.parse(candidate.appliedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: '단계 변경일은 지원일보다 이를 수 없습니다.',
        path: ['stageChangedAt'],
      })
    }
  })

export type Candidate = z.infer<typeof candidateSchema>
