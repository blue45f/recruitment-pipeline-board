import {
  QueryErrorResetBoundary,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Layers3, RadioTower } from 'lucide-react'
import { Suspense, useDeferredValue, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useSearchParams } from 'react-router'

import type {
  Candidate,
  CandidateId,
  CandidateListSize,
  CandidateStage,
} from '@/domains/recruitment/candidates/model'
import {
  candidateDetailQueryOptions,
  candidateListQueryOptions,
} from '@/domains/recruitment/candidates/query'

import {
  DEFAULT_CANDIDATE_FILTERS,
  filterCandidates,
  groupCandidatesByStage,
  projectCandidateStages,
  readCandidateFilters,
  writeCandidateFilters,
  type CandidateStageProjection,
  type CandidateFilters,
  useBoardDetailStore,
  useBoardPreferencesStore,
  useCandidateStageMove,
} from './model'
import { BoardErrorFallback } from './ui/BoardErrorFallback'
import { CandidateBoardSkeleton } from './ui/CandidateBoardSkeleton'
import { CandidateBoardView } from './ui/CandidateBoardView'
import type { CandidateBoardFocusRequest } from './ui/candidateBoardFocus'
import { CandidateDetailModal } from './ui/CandidateDetailModal'
import { CandidateEmptyState } from './ui/CandidateEmptyState'
import { CandidateFilters as CandidateFiltersForm } from './ui/CandidateFilters'
import { CandidateStageChangeDialog } from './ui/CandidateStageChangeDialog'
import {
  CandidateStageMoveErrorNotice,
  CandidateStageMoveVerificationNotice,
} from './ui/CandidateStageMoveErrorNotice'
import { CandidateStageMoveUndoNotice } from './ui/CandidateStageMoveUndoNotice'

type CandidateBoardContentProps = Readonly<{
  filters: CandidateFilters
  focusRequest?: CandidateBoardFocusRequest
  listSize: CandidateListSize
  onClearFilters: (inputMethod: 'keyboard' | 'pointer') => void
  onChangeStage: (candidate: Candidate) => void
  onMoveCandidate: (candidate: Candidate, targetStage: CandidateStage) => void
  onOpenCandidate: (candidateId: CandidateId) => void
  onPrefetchCandidate: (candidateId: CandidateId) => void
  pendingCandidateIds: ReadonlySet<CandidateId>
  stageProjectionByCandidateId: CandidateStageProjection
  stageChangeDisabledCandidateIds: ReadonlySet<CandidateId>
}>

function CandidateBoardContent({
  filters,
  focusRequest,
  listSize,
  onClearFilters,
  onChangeStage,
  onMoveCandidate,
  onOpenCandidate,
  onPrefetchCandidate,
  pendingCandidateIds,
  stageProjectionByCandidateId,
  stageChangeDisabledCandidateIds,
}: CandidateBoardContentProps) {
  const { data: response } = useSuspenseQuery(
    candidateListQueryOptions(listSize),
  )
  const candidates = projectCandidateStages(
    response.data,
    stageProjectionByCandidateId,
  )

  if (candidates.length === 0) {
    return <CandidateEmptyState reason="no-candidates" />
  }

  const filteredCandidates = filterCandidates(candidates, filters)

  if (filteredCandidates.length === 0) {
    return (
      <CandidateEmptyState
        onClearFilters={onClearFilters}
        reason="no-results"
      />
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]" role="status">
          전체{' '}
          <strong className="font-data text-[var(--color-ink)]">
            {response.meta.total.toLocaleString('ko-KR')}
          </strong>
          명 중{' '}
          <strong className="font-data text-[var(--color-cobalt-strong)]">
            {filteredCandidates.length.toLocaleString('ko-KR')}
          </strong>
          명을 표시합니다.
        </p>
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-success)]">
          <RadioTower aria-hidden="true" className="size-3.5" />
          Mock API 연결됨
        </p>
      </div>
      <CandidateBoardView
        candidatesByStage={groupCandidatesByStage(filteredCandidates)}
        {...(focusRequest === undefined ? {} : { focusRequest })}
        onChangeStage={onChangeStage}
        onMoveCandidate={onMoveCandidate}
        onOpenCandidate={onOpenCandidate}
        onPrefetchCandidate={onPrefetchCandidate}
        pendingCandidateIds={pendingCandidateIds}
        scrollResetKey={`${listSize}:${filters.query}:${filters.role}`}
        stageChangeDisabledCandidateIds={stageChangeDisabledCandidateIds}
      />
    </>
  )
}

export function RecruitmentBoard() {
  const boardRegionRef = useRef<HTMLElement>(null)
  const focusRequestSequence = useRef(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [stageChangeCandidate, setStageChangeCandidate] =
    useState<Candidate | null>(null)
  const [focusRequest, setFocusRequest] = useState<CandidateBoardFocusRequest>()
  const queryClient = useQueryClient()
  const {
    moveCandidate,
    pendingCandidateIds,
    retryCandidate,
    stageMoveFailureByCandidateId,
    stageMoveVerificationByCandidateId,
    stageProjectionByCandidateId,
    undoLatest,
    undoPendingCandidateIds,
    undoState,
    verificationPendingCandidateIds,
    verifyCandidate,
  } = useCandidateStageMove()
  const openCandidate = useBoardDetailStore((state) => state.openCandidate)
  const selectedCandidateId = useBoardDetailStore(
    (state) => state.selectedCandidateId,
  )
  const listSize = useBoardPreferencesStore((state) => state.listSize)
  const setListSize = useBoardPreferencesStore((state) => state.setListSize)
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readCandidateFilters(searchParams)
  const deferredQuery = useDeferredValue(filters.query)
  const deferredRole = useDeferredValue(filters.role)
  const deferredListSize = useDeferredValue(listSize)
  const deferredFilters: CandidateFilters = {
    query: deferredQuery,
    role: deferredRole,
  }
  const isBoardPending =
    deferredQuery !== filters.query ||
    deferredRole !== filters.role ||
    deferredListSize !== listSize
  const updateFilters = (nextFilters: CandidateFilters) => {
    setSearchParams(writeCandidateFilters(nextFilters), { replace: true })
  }
  const requestCandidateStageFocus = (candidateId: CandidateId) => {
    if (selectedCandidateId === null) {
      focusRequestSequence.current += 1
      const nextFocusRequest = {
        candidateId,
        requestId: focusRequestSequence.current,
      }

      window.requestAnimationFrame(() => {
        setFocusRequest(nextFocusRequest)
      })
    }
  }

  const submitStageMove = (candidate: Candidate, stage: CandidateStage) => {
    requestCandidateStageFocus(candidate.id)

    moveCandidate(candidate, stage)
  }
  const boardStageMoveFailures = Array.from(
    stageMoveFailureByCandidateId.values(),
  ).filter(({ candidateId }) => candidateId !== selectedCandidateId)
  const boardStageMoveVerifications = Array.from(
    stageMoveVerificationByCandidateId.values(),
  ).filter(({ candidateId }) => candidateId !== selectedCandidateId)
  const undoLatestFromBoard = (inputMethod: 'keyboard' | 'pointer') => {
    const receipt = undoState?.receipt
    const submission = undoLatest()

    if (inputMethod !== 'keyboard' || receipt === undefined) return

    if (submission.accepted) {
      void submission.completion.then(() => {
        if (useBoardDetailStore.getState().selectedCandidateId === null) {
          requestCandidateStageFocus(receipt.candidateId)
        }
      })
      return
    }

    requestCandidateStageFocus(receipt.candidateId)
  }
  const undoStageChangeDisabledCandidateIds =
    undoState?.status === 'verification-required'
      ? new Set([...undoPendingCandidateIds, undoState.receipt.candidateId])
      : undoPendingCandidateIds
  const boardUndoSafeMessageProps =
    undoState?.status === 'failure' ||
    undoState?.status === 'verification-required'
      ? { safeMessage: undoState.safeMessage }
      : {}

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

        <CandidateFiltersForm
          filters={filters}
          listSize={listSize}
          onFiltersChange={updateFilters}
          onListSizeChange={setListSize}
          searchInputRef={searchInputRef}
        />

        <section
          aria-busy={isBoardPending || undefined}
          aria-labelledby="pipeline-board-title"
          className="bg-[var(--color-fog)] px-3 py-5 sm:px-5 lg:px-7 lg:py-7"
          ref={boardRegionRef}
          tabIndex={-1}
        >
          <h2 className="sr-only" id="pipeline-board-title">
            채용 단계별 후보자
          </h2>
          {undoState && selectedCandidateId === null ? (
            <div className="mb-4">
              <CandidateStageMoveUndoNotice
                candidateName={undoState.receipt.candidateName}
                fromStage={undoState.receipt.fromStage}
                onAction={undoLatestFromBoard}
                {...boardUndoSafeMessageProps}
                status={undoState.status}
                toStage={undoState.receipt.toStage}
              />
            </div>
          ) : null}
          {boardStageMoveFailures.length > 0 ||
          boardStageMoveVerifications.length > 0 ? (
            <div className="mb-4 grid gap-3">
              {boardStageMoveFailures.map((failure) => (
                <CandidateStageMoveErrorNotice
                  failure={failure}
                  key={`${failure.candidateId}:failure:${failure.completedAt}`}
                  onRetry={() => {
                    requestCandidateStageFocus(failure.candidateId)
                    retryCandidate(failure.candidateId)
                  }}
                />
              ))}
              {boardStageMoveVerifications.map((verification) => (
                <CandidateStageMoveVerificationNotice
                  isVerifying={verificationPendingCandidateIds.has(
                    verification.candidateId,
                  )}
                  key={`${verification.candidateId}:verification`}
                  onVerify={() => {
                    void verifyCandidate(verification.candidateId).then(
                      (resolution) => {
                        if (resolution.status !== 'verification-required') {
                          requestCandidateStageFocus(verification.candidateId)
                        }
                      },
                    )
                  }}
                  verification={verification}
                />
              ))}
            </div>
          ) : null}
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
                resetKeys={[deferredListSize]}
              >
                <Suspense fallback={<CandidateBoardSkeleton />}>
                  <CandidateBoardContent
                    filters={deferredFilters}
                    {...(focusRequest === undefined ? {} : { focusRequest })}
                    listSize={deferredListSize}
                    onClearFilters={(inputMethod) => {
                      if (inputMethod === 'keyboard') {
                        searchInputRef.current?.focus()
                      }
                      updateFilters(DEFAULT_CANDIDATE_FILTERS)
                    }}
                    onChangeStage={setStageChangeCandidate}
                    onMoveCandidate={submitStageMove}
                    onOpenCandidate={openCandidate}
                    onPrefetchCandidate={(candidateId) => {
                      void queryClient.prefetchQuery(
                        candidateDetailQueryOptions(candidateId),
                      )
                    }}
                    pendingCandidateIds={pendingCandidateIds}
                    stageProjectionByCandidateId={stageProjectionByCandidateId}
                    stageChangeDisabledCandidateIds={
                      undoStageChangeDisabledCandidateIds
                    }
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </section>
      </div>
      <CandidateDetailModal
        fallbackFocusRef={boardRegionRef}
        onChangeStage={setStageChangeCandidate}
        onRetryStageMove={retryCandidate}
        onVerifyStageMove={verifyCandidate}
        onUndoStageMove={undoLatest}
        pendingCandidateIds={pendingCandidateIds}
        stageMoveFailureByCandidateId={stageMoveFailureByCandidateId}
        stageMoveVerificationByCandidateId={stageMoveVerificationByCandidateId}
        stageProjectionByCandidateId={stageProjectionByCandidateId}
        undoPendingCandidateIds={undoStageChangeDisabledCandidateIds}
        {...(undoState === undefined ? {} : { undoState })}
        verificationPendingCandidateIds={verificationPendingCandidateIds}
      />
      {stageChangeCandidate ? (
        <CandidateStageChangeDialog
          candidate={stageChangeCandidate}
          fallbackFocusRef={boardRegionRef}
          onClose={() => setStageChangeCandidate(null)}
          onMoveCandidate={submitStageMove}
        />
      ) : null}
    </main>
  )
}
