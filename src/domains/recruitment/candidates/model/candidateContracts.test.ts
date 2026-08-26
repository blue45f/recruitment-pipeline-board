import { describe, expect, it } from 'vitest'

import {
  CANDIDATE_STAGE_LABELS,
  CANDIDATE_STAGES,
  candidateApiErrorResponseSchema,
  candidateDetailRequestSchema,
  candidateDetailResponseSchema,
  candidateListRequestSchema,
  candidateListResponseSchema,
  candidateSchema,
  candidateStageUpdateRequestSchema,
  candidateStageUpdateResponseSchema,
} from './index'

const validCandidate = {
  id: 'candidate-0000001-0001',
  name: '김민지',
  role: 'frontend_engineer',
  appliedAt: '2026-06-01T09:00:00.000Z',
  currentStage: 'interview',
  email: 'candidate-0001@example.test',
  experienceYears: 5,
  memo: '사용자 문제를 구조적으로 해결한 경험이 인상적입니다.',
  stageChangedAt: '2026-06-08T09:00:00.000Z',
  revision: 1,
} as const

describe('후보자 도메인 계약', () => {
  it('다섯 단계의 순서와 한글 라벨을 고정한다', () => {
    expect(CANDIDATE_STAGES).toEqual([
      'document_review',
      'interview',
      'offer_discussion',
      'hired',
      'rejected',
    ])
    expect(CANDIDATE_STAGE_LABELS).toEqual({
      document_review: '서류검토',
      interview: '면접',
      offer_discussion: '처우협의',
      hired: '최종합격',
      rejected: '불합격',
    })
  })

  it('카드와 상세 화면이 함께 사용할 후보자를 검증한다', () => {
    expect(candidateSchema.parse(validCandidate)).toEqual(validCandidate)
  })

  it.each([
    ['잘못된 지원일', { ...validCandidate, appliedAt: '2026/06/01' }],
    ['잘못된 이메일', { ...validCandidate, email: 'not-an-email' }],
    ['알 수 없는 단계', { ...validCandidate, currentStage: 'unknown' }],
    ['빈 이름', { ...validCandidate, name: '   ' }],
    ['빈 메모', { ...validCandidate, memo: '' }],
    [
      '지원일보다 이른 단계 변경일',
      { ...validCandidate, stageChangedAt: '2026-05-31T09:00:00.000Z' },
    ],
  ])('%s을 거부한다', (_, candidate) => {
    expect(candidateSchema.safeParse(candidate).success).toBe(false)
  })

  it('목록 요청과 응답의 크기를 검증한다', () => {
    expect(candidateListRequestSchema.parse({ size: 200 })).toEqual({
      size: 200,
    })
    expect(
      candidateListResponseSchema.parse({
        data: [validCandidate],
        meta: { total: 1 },
      }),
    ).toEqual({ data: [validCandidate], meta: { total: 1 } })
    expect(candidateListRequestSchema.safeParse({ size: 100 }).success).toBe(
      false,
    )
    expect(
      candidateListResponseSchema.safeParse({
        data: [validCandidate],
        meta: { total: 2 },
      }).success,
    ).toBe(false)
  })

  it('단건 요청과 응답을 검증한다', () => {
    expect(
      candidateDetailRequestSchema.parse({ candidateId: validCandidate.id }),
    ).toEqual({ candidateId: validCandidate.id })
    expect(
      candidateDetailResponseSchema.parse({ data: validCandidate }),
    ).toEqual({ data: validCandidate })
    expect(
      candidateDetailRequestSchema.safeParse({ candidateId: '' }).success,
    ).toBe(false)
  })

  it('단계 변경 요청과 응답의 동시성 필드를 검증한다', () => {
    const request = {
      stage: 'offer_discussion',
      expectedRevision: 1,
      clientMutationId: 'mutation-0001',
    } as const
    const response = {
      data: {
        ...validCandidate,
        currentStage: 'offer_discussion',
        revision: 2,
      },
      meta: {
        requestId: 'request-0001',
        clientMutationId: request.clientMutationId,
        undoReceipt: {
          candidateId: validCandidate.id,
          clientMutationId: request.clientMutationId,
          previousStage: validCandidate.currentStage,
          currentStage: 'offer_discussion',
          expectedRevision: 1,
          committedRevision: 2,
        },
      },
    } as const

    expect(candidateStageUpdateRequestSchema.parse(request)).toEqual(request)
    expect(candidateStageUpdateResponseSchema.parse(response)).toEqual(response)
    expect(
      candidateStageUpdateRequestSchema.safeParse({
        ...request,
        expectedRevision: -1,
      }).success,
    ).toBe(false)
  })

  it('보상 요청은 원 mutation ID와 다른 새 ID만 허용한다', () => {
    const compensation = {
      stage: 'interview',
      expectedRevision: 2,
      clientMutationId: 'mutation-undo-0001',
      compensatesClientMutationId: 'mutation-move-0001',
    } as const

    expect(candidateStageUpdateRequestSchema.parse(compensation)).toEqual(
      compensation,
    )
    expect(
      candidateStageUpdateRequestSchema.safeParse({
        ...compensation,
        compensatesClientMutationId: compensation.clientMutationId,
      }).success,
    ).toBe(false)
  })

  it.each([
    ['후보자 ID', { candidateId: 'candidate-another-0001' }],
    ['mutation ID', { clientMutationId: 'mutation-another' }],
    ['현재 단계', { currentStage: 'hired' as const }],
    ['commit revision', { committedRevision: 3 }],
  ])('응답과 상관관계가 다른 Undo receipt의 %s를 거부한다', (_, change) => {
    const response = {
      data: {
        ...validCandidate,
        currentStage: 'offer_discussion' as const,
        revision: 2,
      },
      meta: {
        requestId: 'request-correlated',
        clientMutationId: 'mutation-correlated',
        undoReceipt: {
          candidateId: validCandidate.id,
          clientMutationId: 'mutation-correlated',
          previousStage: validCandidate.currentStage,
          currentStage: 'offer_discussion' as const,
          expectedRevision: 1,
          committedRevision: 2,
          ...change,
        },
      },
    }

    expect(candidateStageUpdateResponseSchema.safeParse(response).success).toBe(
      false,
    )
  })

  it.each([
    'REVISION_CONFLICT',
    'IDEMPOTENCY_KEY_CONFLICT',
    'UNDO_NOT_AVAILABLE',
  ] as const)('%s 오류 코드를 안전한 409 계약으로 검증한다', (code) => {
    const response = {
      error: {
        code,
        message: '화면에 직접 노출하지 않는 서버 메시지',
        requestId: 'request-conflict',
        retryable: false,
      },
    } as const

    expect(candidateApiErrorResponseSchema.parse(response)).toEqual(response)
  })

  it('알 수 없는 서버 오류 코드를 계약에서 거부한다', () => {
    expect(
      candidateApiErrorResponseSchema.safeParse({
        error: {
          code: 'DATABASE_INTERNAL_DETAIL',
          message: 'private server detail',
          requestId: 'request-unknown-code',
          retryable: false,
        },
      }).success,
    ).toBe(false)
  })
})
