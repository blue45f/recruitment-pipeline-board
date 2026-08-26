import {
  QueryErrorResetBoundary,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Suspense, useRef, type RefObject } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ApiError } from '@/domains/recruitment/candidates/api'
import type {
  Candidate,
  CandidateId,
  CandidateListResponse,
} from '@/domains/recruitment/candidates/model'
import {
  candidateDetailQueryOptions,
  candidateQueryKeys,
} from '@/domains/recruitment/candidates/query'

import { useBoardDetailStore } from '../model'
import { CandidateDetailView } from './CandidateDetailView'

function CandidateDetailSkeleton() {
  return (
    <div
      aria-label="후보자 상세 정보를 불러오는 중입니다"
      aria-live="polite"
      className="min-h-[25rem] space-y-6"
      role="status"
    >
      <div
        aria-hidden="true"
        className="h-32 animate-pulse rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] motion-reduce:animate-none"
      />
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
        {['email', 'experience', 'applied-at', 'stage'].map((key) => (
          <div
            className="h-16 animate-pulse border-b border-[var(--color-line)] motion-reduce:animate-none"
            key={key}
          >
            <span className="block h-3 w-14 rounded bg-[var(--color-line)]" />
            <span className="mt-3 block h-4 w-36 rounded bg-[var(--color-line)]" />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="h-28 animate-pulse rounded-xl bg-[var(--color-surface)] motion-reduce:animate-none"
      />
    </div>
  )
}

function getSafeDetailErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.safeMessage
    : '후보자 상세 정보를 표시하지 못했습니다.'
}

type CandidateDetailErrorFallbackProps = Readonly<{
  error: unknown
  onRetry: (inputMethod: 'keyboard' | 'pointer') => void
}>

function CandidateDetailErrorFallback({
  error,
  onRetry,
}: CandidateDetailErrorFallbackProps) {
  const canRetry = error instanceof ApiError && error.retryable

  return (
    <section
      aria-labelledby="candidate-detail-error-title"
      className="grid min-h-[25rem] place-items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6"
      role="alert"
    >
      <div className="max-w-sm text-center">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto size-8 text-[var(--color-danger)]"
        />
        <h3
          className="mt-4 text-lg font-semibold tracking-[-0.02em]"
          id="candidate-detail-error-title"
        >
          상세 정보를 불러오지 못했어요
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {getSafeDetailErrorMessage(error)}
        </p>
        {canRetry ? (
          <Button
            className="mt-5"
            onClick={(event) =>
              onRetry(event.detail === 0 ? 'keyboard' : 'pointer')
            }
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            다시 시도
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function CandidateDetailContent({
  candidateId,
  onChangeStage,
  pendingCandidateIds,
}: Readonly<{
  candidateId: CandidateId
  onChangeStage?: (candidate: Candidate) => void
  pendingCandidateIds: ReadonlySet<CandidateId>
}>) {
  const { data: response } = useSuspenseQuery(
    candidateDetailQueryOptions(candidateId),
  )

  return (
    <>
      <p
        aria-label={`${response.data.name} 후보자 상세 정보를 불러왔습니다.`}
        className="sr-only"
        role="status"
      >
        {response.data.name} 후보자 상세 정보를 불러왔습니다.
      </p>
      <CandidateDetailView
        candidate={response.data}
        isStageChangePending={pendingCandidateIds.has(response.data.id)}
        {...(onChangeStage === undefined ? {} : { onChangeStage })}
      />
    </>
  )
}

export type CandidateDetailModalProps = Readonly<{
  fallbackFocusRef: RefObject<HTMLElement | null>
  onChangeStage?: (candidate: Candidate) => void
  pendingCandidateIds?: ReadonlySet<CandidateId>
}>

const EMPTY_PENDING_CANDIDATE_IDS = new Set<CandidateId>()

export function CandidateDetailModal({
  fallbackFocusRef,
  onChangeStage,
  pendingCandidateIds = EMPTY_PENDING_CANDIDATE_IDS,
}: CandidateDetailModalProps) {
  const detailPanelRef = useRef<HTMLDivElement>(null)
  const restoreFocusCandidateId = useRef<CandidateId | null>(null)
  const queryClient = useQueryClient()
  const selectedCandidateId = useBoardDetailStore(
    (state) => state.selectedCandidateId,
  )
  const closeCandidate = useBoardDetailStore((state) => state.closeCandidate)
  const candidateName = queryClient
    .getQueriesData<CandidateListResponse>({
      queryKey: candidateQueryKeys.lists(),
    })
    .flatMap(([, response]) => response?.data ?? [])
    .find((candidate) => candidate.id === selectedCandidateId)?.name

  return (
    <Modal
      description={
        candidateName
          ? `${candidateName} 후보자의 지원 정보와 현재 채용 단계를 확인합니다.`
          : '선택한 후보자의 지원 정보와 현재 채용 단계를 확인합니다.'
      }
      onCloseAutoFocus={(event) => {
        const candidateCard = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[data-candidate-id]'),
        ).find(
          (card) =>
            card.dataset.candidateId === restoreFocusCandidateId.current,
        )

        restoreFocusCandidateId.current = null

        if (candidateCard) {
          event.preventDefault()
          candidateCard.focus()
          return
        }

        event.preventDefault()
        fallbackFocusRef.current?.focus()
      }}
      onOpenChange={(open) => {
        if (!open) {
          restoreFocusCandidateId.current = selectedCandidateId
          closeCandidate()
        }
      }}
      open={selectedCandidateId !== null}
      title={candidateName ? `${candidateName} 후보자 상세` : '후보자 상세'}
    >
      {selectedCandidateId ? (
        <div
          className="outline-none"
          data-testid="candidate-detail-content"
          ref={detailPanelRef}
          tabIndex={-1}
        >
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary
                fallbackRender={({ error, resetErrorBoundary }) => (
                  <CandidateDetailErrorFallback
                    error={error}
                    onRetry={(inputMethod) => {
                      if (inputMethod === 'keyboard') {
                        detailPanelRef.current?.focus()
                      }
                      resetErrorBoundary()
                    }}
                  />
                )}
                onReset={reset}
                resetKeys={[selectedCandidateId]}
              >
                <Suspense fallback={<CandidateDetailSkeleton />}>
                  <CandidateDetailContent
                    candidateId={selectedCandidateId}
                    {...(onChangeStage === undefined ? {} : { onChangeStage })}
                    pendingCandidateIds={pendingCandidateIds}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </div>
      ) : null}
    </Modal>
  )
}
