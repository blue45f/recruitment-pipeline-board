import { SearchX, UserRoundPlus } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/classNames'

type NoCandidatesEmptyStateProps = Readonly<{
  reason: 'no-candidates'
}>

type NoResultsEmptyStateProps = Readonly<{
  onClearFilters: (inputMethod: 'keyboard' | 'pointer') => void
  reason: 'no-results'
}>

export type CandidateEmptyStateProps =
  NoCandidatesEmptyStateProps | NoResultsEmptyStateProps

export function CandidateEmptyState(props: CandidateEmptyStateProps) {
  const hasNoCandidates = props.reason === 'no-candidates'
  const Icon = hasNoCandidates ? UserRoundPlus : SearchX

  return (
    <section
      aria-live="polite"
      className={cn(
        'grid min-h-[42.125rem] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)] px-6 text-center',
        hasNoCandidates
          ? 'place-items-center py-16'
          : 'content-start justify-items-center py-10 sm:place-items-center sm:py-16',
      )}
      role="status"
    >
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-cobalt-soft)] text-[var(--color-cobalt-strong)]">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <p className="font-data mt-5 text-xs font-semibold tracking-[0.16em] text-[var(--color-cobalt-strong)] uppercase">
          {hasNoCandidates ? 'Empty pipeline' : 'No matches'}
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.025em] text-[var(--color-ink)]">
          {hasNoCandidates
            ? '등록된 후보자가 없습니다'
            : '조건에 맞는 후보자가 없습니다'}
        </h2>
        <p className="mt-3 text-sm leading-6 break-keep text-[var(--color-muted)]">
          {hasNoCandidates
            ? '후보자 데이터가 추가되면 채용 단계별로 이곳에 표시됩니다.'
            : '검색어나 직무 필터를 바꾸거나 조건을 초기화해 보세요.'}
        </p>
        {!hasNoCandidates ? (
          <Button
            className="mt-6"
            onClick={(event) =>
              props.onClearFilters(event.detail === 0 ? 'keyboard' : 'pointer')
            }
            variant="secondary"
          >
            검색 조건 지우기
          </Button>
        ) : null}
      </div>
    </section>
  )
}
