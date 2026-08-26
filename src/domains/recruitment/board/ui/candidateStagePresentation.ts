import type { CandidateStage } from '@/domains/recruitment/candidates/model'

export const CANDIDATE_STAGE_PRESENTATION = {
  document_review: {
    accentClassName: 'bg-[var(--color-line-strong)]',
    badgeTone: 'neutral',
    index: '01',
  },
  interview: {
    accentClassName: 'bg-[var(--color-cobalt)]',
    badgeTone: 'info',
    index: '02',
  },
  offer_discussion: {
    accentClassName: 'bg-[var(--color-warning)]',
    badgeTone: 'attention',
    index: '03',
  },
  hired: {
    accentClassName: 'bg-[var(--color-success)]',
    badgeTone: 'success',
    index: '04',
  },
  rejected: {
    accentClassName: 'bg-[var(--color-danger)]',
    badgeTone: 'danger',
    index: '05',
  },
} as const satisfies Record<
  CandidateStage,
  {
    accentClassName: string
    badgeTone: 'attention' | 'danger' | 'info' | 'neutral' | 'success'
    index: string
  }
>
