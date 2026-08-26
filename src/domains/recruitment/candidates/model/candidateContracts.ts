import { z } from 'zod'

import { candidateIdSchema, candidateSchema } from './candidate'
import { candidateStageSchema } from './candidateStage'

export const CANDIDATE_API_ERROR_CODES = [
  'INVALID_REQUEST',
  'CANDIDATE_NOT_FOUND',
  'REVISION_CONFLICT',
  'IDEMPOTENCY_KEY_CONFLICT',
  'UNDO_NOT_AVAILABLE',
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
    compensatesClientMutationId: clientMutationIdSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.compensatesClientMutationId !== undefined &&
      request.compensatesClientMutationId === request.clientMutationId
    ) {
      context.addIssue({
        code: 'custom',
        message: '보상 요청은 원 요청과 다른 식별자를 사용해야 합니다.',
        path: ['compensatesClientMutationId'],
      })
    }
  })

export type CandidateStageUpdateRequest = z.infer<
  typeof candidateStageUpdateRequestSchema
>

export const candidateStageUndoReceiptSchema = z
  .object({
    candidateId: candidateIdSchema,
    clientMutationId: clientMutationIdSchema,
    previousStage: candidateStageSchema,
    currentStage: candidateStageSchema,
    expectedRevision: z.number().int().nonnegative(),
    committedRevision: z.number().int().positive(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.committedRevision !== receipt.expectedRevision + 1) {
      context.addIssue({
        code: 'custom',
        message: 'Undo receipt revision이 단계 변경과 이어지지 않습니다.',
        path: ['committedRevision'],
      })
    }
  })

export type CandidateStageUndoReceipt = z.infer<
  typeof candidateStageUndoReceiptSchema
>

export const candidateStageUpdateResponseSchema = z
  .object({
    data: candidateSchema,
    meta: z
      .object({
        requestId: z.string().trim().min(1).max(100),
        clientMutationId: clientMutationIdSchema,
        undoReceipt: candidateStageUndoReceiptSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((response, context) => {
    const receipt = response.meta.undoReceipt

    if (receipt === undefined) {
      return
    }

    const checks = [
      {
        matches: receipt.candidateId === response.data.id,
        message: 'Undo receipt 후보자 ID가 응답과 다릅니다.',
        path: ['meta', 'undoReceipt', 'candidateId'],
      },
      {
        matches: receipt.clientMutationId === response.meta.clientMutationId,
        message: 'Undo receipt mutation ID가 응답과 다릅니다.',
        path: ['meta', 'undoReceipt', 'clientMutationId'],
      },
      {
        matches: receipt.currentStage === response.data.currentStage,
        message: 'Undo receipt 단계가 응답과 다릅니다.',
        path: ['meta', 'undoReceipt', 'currentStage'],
      },
      {
        matches: receipt.committedRevision === response.data.revision,
        message: 'Undo receipt revision이 응답과 다릅니다.',
        path: ['meta', 'undoReceipt', 'committedRevision'],
      },
    ] as const

    for (const check of checks) {
      if (!check.matches) {
        context.addIssue({
          code: 'custom',
          message: check.message,
          path: [...check.path],
        })
      }
    }
  })

export type CandidateStageUpdateResponse = z.infer<
  typeof candidateStageUpdateResponseSchema
>
