import { z } from 'zod'

import { candidateIdSchema, candidateSchema } from './candidate'
import { candidateStageSchema } from './candidateStage'

export const CANDIDATE_API_ERROR_CODES = [
  'INVALID_REQUEST',
  'CANDIDATE_NOT_FOUND',
  'REVISION_CONFLICT',
  'IDEMPOTENCY_KEY_CONFLICT',
  'SIMULATED_FAILURE',
  'PERSISTENCE_FAILURE',
] as const

export const candidateApiErrorCodeSchema = z.enum(CANDIDATE_API_ERROR_CODES)

export type CandidateApiErrorCode = z.infer<typeof candidateApiErrorCodeSchema>

export const candidateApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: candidateApiErrorCodeSchema,
        message: z.string().trim().min(1).max(500),
        requestId: z.string().trim().min(1).max(100),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict()

export type CandidateApiErrorResponse = z.infer<
  typeof candidateApiErrorResponseSchema
>

export const CANDIDATE_LIST_SIZES = [0, 200, 1_000] as const

export const candidateListSizeSchema = z.literal(CANDIDATE_LIST_SIZES)

export type CandidateListSize = z.infer<typeof candidateListSizeSchema>

export const candidateListRequestSchema = z
  .object({
    size: candidateListSizeSchema,
  })
  .strict()

export type CandidateListRequest = z.infer<typeof candidateListRequestSchema>

export const candidateListResponseSchema = z
  .object({
    data: z.array(candidateSchema).max(1_000),
    meta: z
      .object({
        total: z.number().int().nonnegative().max(1_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.meta.total !== response.data.length) {
      context.addIssue({
        code: 'custom',
        message: '전체 개수와 후보자 목록의 길이가 다릅니다.',
        path: ['meta', 'total'],
      })
    }
  })

export type CandidateListResponse = z.infer<typeof candidateListResponseSchema>

export const candidateDetailRequestSchema = z
  .object({
    candidateId: candidateIdSchema,
  })
  .strict()

export type CandidateDetailRequest = z.infer<
  typeof candidateDetailRequestSchema
>

export const candidateDetailResponseSchema = z
  .object({
    data: candidateSchema,
  })
  .strict()

export type CandidateDetailResponse = z.infer<
  typeof candidateDetailResponseSchema
>

export const clientMutationIdSchema = z.string().trim().min(1).max(100)

export const candidateStageUpdateRequestSchema = z
  .object({
    stage: candidateStageSchema,
    expectedRevision: z.number().int().nonnegative(),
    clientMutationId: clientMutationIdSchema,
  })
  .strict()

export type CandidateStageUpdateRequest = z.infer<
  typeof candidateStageUpdateRequestSchema
>

export const candidateStageUpdateResponseSchema = z
  .object({
    data: candidateSchema,
    meta: z
      .object({
        requestId: z.string().trim().min(1).max(100),
        clientMutationId: clientMutationIdSchema,
      })
      .strict(),
  })
  .strict()

export type CandidateStageUpdateResponse = z.infer<
  typeof candidateStageUpdateResponseSchema
>
