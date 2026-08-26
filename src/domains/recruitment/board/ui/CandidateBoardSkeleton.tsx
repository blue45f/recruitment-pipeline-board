import {
  CANDIDATE_STAGES,
  CANDIDATE_STAGE_LABELS,
} from '@/domains/recruitment/candidates/model'

import { CANDIDATE_STAGE_PRESENTATION } from './candidateStagePresentation'

const SKELETON_CARD_KEYS = ['first', 'second', 'third'] as const

export type CandidateBoardSkeletonProps = Readonly<{
  label?: string
}>

export function CandidateBoardSkeleton({
  label = '후보자 목록을 불러오는 중입니다',
}: CandidateBoardSkeletonProps) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="overflow-hidden pb-3"
      role="status"
    >
      <div aria-hidden="true">
        <div
          className="mb-4 h-5"
          data-testid="candidate-board-summary-skeleton"
        />
        <div className="flex min-w-max gap-3 sm:gap-4">
          {CANDIDATE_STAGES.map((stage) => {
            const presentation = CANDIDATE_STAGE_PRESENTATION[stage]

            return (
              <section
                className="w-72 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] lg:w-[17rem] xl:w-[15.5rem] 2xl:w-[17rem]"
                data-testid="candidate-stage-skeleton"
                key={stage}
              >
                <div className="relative flex min-h-20 items-center border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3.5 pl-5">
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${presentation.accentClassName}`}
                  />
                  <span>
                    <span className="font-data block text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--color-subtle)]">
                      STAGE {presentation.index}
                    </span>
                    <span className="mt-1 block text-base font-bold text-[var(--color-ink)]">
                      {CANDIDATE_STAGE_LABELS[stage]}
                    </span>
                  </span>
                  <span className="ml-auto h-6 w-8 animate-pulse rounded-full bg-[var(--color-line)] motion-reduce:animate-none" />
                </div>
                <div className="h-[34rem] space-y-3 overflow-hidden p-3">
                  {SKELETON_CARD_KEYS.map((key) => (
                    <div
                      className="h-40 animate-pulse rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 motion-reduce:animate-none"
                      key={key}
                    >
                      <span className="block h-4 w-24 rounded bg-[var(--color-line)]" />
                      <span className="mt-3 block h-3 w-36 rounded bg-[var(--color-line)]" />
                      <span className="mt-9 block h-6 w-16 rounded-full bg-[var(--color-line)]" />
                      <span className="mt-3 block h-3 w-28 rounded bg-[var(--color-line)]" />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
