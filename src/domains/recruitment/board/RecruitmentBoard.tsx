import {
  QueryErrorResetBoundary,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Layers3, RadioTower } from 'lucide-react'
import { Suspense, useRef } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { candidateListQueryOptions } from '@/domains/recruitment/candidates/query'

import { groupCandidatesByStage } from './model'
import { BoardErrorFallback } from './ui/BoardErrorFallback'
import { CandidateBoardSkeleton } from './ui/CandidateBoardSkeleton'
import { CandidateBoardView } from './ui/CandidateBoardView'
import { CandidateEmptyState } from './ui/CandidateEmptyState'

function CandidateBoardContent() {
  const { data: response } = useSuspenseQuery(candidateListQueryOptions(200))

  if (response.data.length === 0) {
    return <CandidateEmptyState />
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]" role="status">
          전체{' '}
          <strong className="font-data text-[var(--color-ink)]">
            {response.meta.total.toLocaleString('ko-KR')}
          </strong>
          명을 표시합니다.
        </p>
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-success)]">
          <RadioTower aria-hidden="true" className="size-3.5" />
          Mock API 연결됨
        </p>
      </div>
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(response.data)}
      />
    </>
  )
}

export function RecruitmentBoard() {
  const boardRegionRef = useRef<HTMLElement>(null)

  return (
    <main className="min-h-svh bg-[var(--color-surface)] px-3 py-3 text-[var(--color-ink)] sm:px-5 sm:py-5 lg:px-7">
      <div className="mx-auto min-h-[calc(100svh-1.5rem)] max-w-[104rem] overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper)] shadow-[var(--shadow-panel)] sm:min-h-[calc(100svh-2.5rem)]">
        <header className="flex flex-col gap-4 border-b border-[var(--color-line)] px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center bg-[var(--color-cobalt)] text-white"
            >
              <Layers3 className="size-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-data text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--color-cobalt)]">
                RECRUIT FLOW / PIPELINE
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] break-keep sm:text-3xl">
                채용 후보자 보드
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 break-keep text-[var(--color-muted)]">
                후보자의 현재 단계를 한눈에 살피고 필요한 지원 정보를 빠르게
                확인하세요.
              </p>
            </div>
          </div>

          <p className="font-data border-l-4 border-[var(--color-coral)] bg-[var(--color-coral-soft)] px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-[var(--color-ink)]">
            BOARD / CANDIDATES
          </p>
        </header>

        <section
          aria-labelledby="pipeline-board-title"
          className="bg-[var(--color-fog)] px-3 py-5 sm:px-5 lg:px-7 lg:py-7"
          ref={boardRegionRef}
          tabIndex={-1}
        >
          <h2 className="sr-only" id="pipeline-board-title">
            채용 단계별 후보자
          </h2>
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary
                fallbackRender={({ error, resetErrorBoundary }) => (
                  <BoardErrorFallback
                    error={error}
                    onRetry={(inputMethod) => {
                      if (inputMethod === 'keyboard') {
                        boardRegionRef.current?.focus()
                      }
                      resetErrorBoundary()
                    }}
                  />
                )}
                onReset={reset}
              >
                <Suspense fallback={<CandidateBoardSkeleton />}>
                  <CandidateBoardContent />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </section>
      </div>
    </main>
  )
}
