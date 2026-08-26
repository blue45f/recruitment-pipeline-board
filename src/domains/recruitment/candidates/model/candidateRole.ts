import { z } from 'zod'

export const CANDIDATE_ROLES = [
  'frontend_engineer',
  'backend_engineer',
  'product_designer',
  'product_manager',
  'data_analyst',
  'qa_engineer',
] as const

export const candidateRoleSchema = z.enum(CANDIDATE_ROLES)

export type CandidateRole = z.infer<typeof candidateRoleSchema>

export const CANDIDATE_ROLE_LABELS = {
  frontend_engineer: '프론트엔드 개발자',
  backend_engineer: '백엔드 개발자',
  product_designer: '프로덕트 디자이너',
  product_manager: '프로덕트 매니저',
  data_analyst: '데이터 분석가',
  qa_engineer: 'QA 엔지니어',
} as const satisfies Record<CandidateRole, string>
