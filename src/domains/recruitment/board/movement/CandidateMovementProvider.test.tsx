import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { StrictMode, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  candidateStageUpdateRequestSchema,
  type Candidate,
} from '../../candidates/model'
import { candidateQueryKeys } from '../../candidates/query'
import { server } from '@/mocks/server'
import {
  createCandidateMovementCoordinator,
  type CandidateMovementCoordinator,
} from './CandidateMovementCoordinator'
import {
  useCandidateMovementCoordinator,
  useCandidateMovementSnapshot,
} from './CandidateMovementContext'
import { CandidateMovementProvider } from './CandidateMovementProvider'

const candidate: Candidate = {
  appliedAt: '2026-08-01T00:00:00.000Z',
  currentStage: 'document_review',
  email: 'movement-provider@example.com',
  experienceYears: 5,
  id: 'candidate-movement-provider',
  memo: '이동 Provider 테스트 후보자입니다.',
  name: '김이동',
  revision: 0,
  role: 'frontend_engineer',
  stageChangedAt: '2026-08-01T00:00:00.000Z',
}

function MovementProbe() {
  const coordinator = useCandidateMovementCoordinator()
  const snapshot = useCandidateMovementSnapshot()
  const failure = snapshot.failureByCandidateId.get(candidate.id)

  return (
    <>
      <button
        onClick={() => {
          coordinator.submit({
            candidateId: candidate.id,
            candidateName: candidate.name,
            targetStage: 'interview',
          })
        }}
        type="button"
      >
        면접로 이동
      </button>
      <button onClick={() => coordinator.undoLatest()} type="button">
        실행 취소
      </button>
      <output data-testid="movement-failure">{failure?.kind ?? ''}</output>
      <output data-testid="movement-result">
        {snapshot.lastResultByCandidateId.get(candidate.id)?.status ?? ''}
      </output>
      <output data-testid="undo-status">
        {snapshot.undoState?.status ?? ''}
      </output>
    </>
  )
}

function LifetimeConsumer({ candidate }: Readonly<{ candidate: Candidate }>) {
  const coordinator = useCandidateMovementCoordinator()
  const snapshot = useCandidateMovementSnapshot()

  return (
    <>
      <button
        onClick={() => {
          coordinator.submit({
            candidateId: candidate.id,
            candidateName: candidate.name,
            targetStage: 'interview',
          })
        }}
        type="button"
      >
        이동 시작
      </button>
      <output data-testid="lifetime-projection">
        {snapshot.stageProjectionByCandidateId.get(candidate.id) ?? ''}
      </output>
      <output data-testid="lifetime-result">
        {snapshot.lastResultByCandidateId.get(candidate.id)?.status ?? ''}
      </output>
    </>
  )
}

function RouteLifetimeHarness({
  candidate,
}: Readonly<{ candidate: Candidate }>) {
  const [isRouteMounted, setRouteMounted] = useState(true)

  return (
    <>
      <button
        onClick={() => setRouteMounted((mounted) => !mounted)}
        type="button"
      >
        {isRouteMounted ? '라우트 해제' : '라우트 복귀'}
      </button>
      {isRouteMounted ? <LifetimeConsumer candidate={candidate} /> : null}
    </>
  )
}

function renderWithProvider(
  queryClient: QueryClient,
  children: ReactNode,
  coordinator?: CandidateMovementCoordinator,
) {
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <CandidateMovementProvider
          {...(coordinator === undefined ? {} : { coordinator })}
        >
          {children}
        </CandidateMovementProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

describe('CandidateMovementProvider', () => {
  it('보상 409를 재전송하지 않고 정규화한 이유까지 안전하게 알린다', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    const toastError = vi.spyOn(toast, 'error')
    const patchBodies: unknown[] = []

    onTestFinished(() => toastError.mockRestore())
    queryClient.setQueryData(candidateQueryKeys.list(200), {
      data: [candidate],
      meta: { total: 1 },
    })
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', async ({ request }) => {
        const body = candidateStageUpdateRequestSchema.parse(
          await request.json(),
        )

        patchBodies.push(body)

        if (body.compensatesClientMutationId !== undefined) {
          return HttpResponse.json(
            {
              error: {
                code: 'UNDO_NOT_AVAILABLE',
                message: 'untrusted compensation detail',
                requestId: 'undo-not-available',
                retryable: false,
              },
            },
            {
              headers: { 'x-request-id': 'undo-not-available' },
              status: 409,
            },
          )
        }

        const movedCandidate: Candidate = {
          ...candidate,
          currentStage: body.stage,
          revision: body.expectedRevision + 1,
          stageChangedAt: '2026-08-27T00:00:00.000Z',
        }

        return HttpResponse.json({
          data: movedCandidate,
          meta: {
            clientMutationId: body.clientMutationId,
            requestId: 'forward-success',
            undoReceipt: {
              candidateId: candidate.id,
              clientMutationId: body.clientMutationId,
              committedRevision: movedCandidate.revision,
              currentStage: movedCandidate.currentStage,
              expectedRevision: body.expectedRevision,
              previousStage: candidate.currentStage,
            },
          },
        })
      }),
      http.get('*/api/candidates/:candidateId', () =>
        HttpResponse.json({
          data: {
            ...candidate,
            currentStage: 'interview',
            revision: 1,
            stageChangedAt: '2026-08-27T00:00:00.000Z',
          },
        }),
      ),
    )

    renderWithProvider(queryClient, <MovementProbe />)
    await user.click(screen.getByRole('button', { name: '면접로 이동' }))

    await vi.waitFor(() => {
      expect(screen.getByTestId('undo-status')).toHaveTextContent('available')
    })
    await user.click(screen.getByRole('button', { name: '실행 취소' }))

    await vi.waitFor(() => {
      expect(screen.getByTestId('undo-status')).toHaveTextContent('')
    })
    expect(patchBodies).toHaveLength(2)
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining(
        '이 단계 변경은 더 이상 되돌릴 수 없습니다. 최신 상태를 확인해 주세요.',
      ),
    )
    expect(toastError).not.toHaveBeenCalledWith(
      expect.stringContaining('untrusted compensation detail'),
    )
  })

  it('409가 아닌 응답의 revision 코드는 rebase하지 않는다', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    let patchCount = 0
    let detailCount = 0

    queryClient.setQueryData(candidateQueryKeys.list(200), {
      data: [candidate],
      meta: { total: 1 },
    })
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () => {
        patchCount += 1
        return HttpResponse.json(
          {
            error: {
              code: 'REVISION_CONFLICT',
              message: 'untrusted server message',
              requestId: 'wrong-status-conflict',
              retryable: false,
            },
          },
          {
            headers: { 'x-request-id': 'wrong-status-conflict' },
            status: 503,
          },
        )
      }),
      http.get('*/api/candidates/:candidateId', () => {
        detailCount += 1
        return HttpResponse.json({ data: candidate })
      }),
    )

    renderWithProvider(queryClient, <MovementProbe />)
    await user.click(screen.getByRole('button', { name: '면접로 이동' }))

    await vi.waitFor(() => {
      expect(screen.getByTestId('movement-failure')).toHaveTextContent('failed')
    })
    expect(patchCount).toBe(1)
    expect(detailCount).toBe(0)
  })

  it('consumer 라우트가 해제돼도 요청과 projection을 Provider에 유지한다', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    let resolveExecution:
      ((execution: Readonly<{ candidate: Candidate }>) => void) | undefined
    const execute = vi.fn(
      () =>
        new Promise<Readonly<{ candidate: Candidate }>>((resolve) => {
          resolveExecution = resolve
        }),
    )
    let confirmedCandidate = candidate
    const coordinator = createCandidateMovementCoordinator({
      execute,
      mergeConfirmed: (nextCandidate) => {
        confirmedCandidate = nextCandidate
      },
      notify: vi.fn(),
      readConfirmedCandidate: () => confirmedCandidate,
      reconcile: vi.fn(async () => confirmedCandidate),
    })

    renderWithProvider(
      queryClient,
      <RouteLifetimeHarness candidate={candidate} />,
      coordinator,
    )

    await user.click(screen.getByRole('button', { name: '이동 시작' }))
    expect(screen.getByTestId('lifetime-projection')).toHaveTextContent(
      'interview',
    )
    expect(execute).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: '라우트 해제' }))

    resolveExecution?.({
      candidate: {
        ...candidate,
        currentStage: 'interview',
        revision: candidate.revision + 1,
        stageChangedAt: '2026-08-27T00:00:00.000Z',
      },
    })

    await vi.waitFor(() => {
      expect(confirmedCandidate.currentStage).toBe('interview')
    })

    await user.click(screen.getByRole('button', { name: '라우트 복귀' }))

    expect(screen.getByTestId('lifetime-projection')).toHaveTextContent('')
    expect(screen.getByTestId('lifetime-result')).toHaveTextContent('success')
    expect(execute).toHaveBeenCalledOnce()
  })

  it('reconcile 응답보다 cache revision이 높으면 최신 확정 상태를 반환한다', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    const listKey = candidateQueryKeys.list(200)
    const latestCandidate: Candidate = {
      ...candidate,
      currentStage: 'interview',
      revision: 2,
      stageChangedAt: '2026-08-27T02:00:00.000Z',
    }
    const staleReconcileCandidate: Candidate = {
      ...candidate,
      revision: 1,
      stageChangedAt: '2026-08-27T01:00:00.000Z',
    }
    let patchCount = 0

    queryClient.setQueryData(listKey, {
      data: [candidate],
      meta: { total: 1 },
    })
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () => {
        patchCount += 1
        return HttpResponse.json(
          {
            error: {
              code: 'REVISION_CONFLICT',
              message: 'untrusted conflict detail',
              requestId: 'provider-revision-conflict',
              retryable: false,
            },
          },
          {
            headers: { 'x-request-id': 'provider-revision-conflict' },
            status: 409,
          },
        )
      }),
      http.get('*/api/candidates/:candidateId', () => {
        queryClient.setQueryData(listKey, {
          data: [latestCandidate],
          meta: { total: 1 },
        })

        return HttpResponse.json({ data: staleReconcileCandidate })
      }),
    )

    renderWithProvider(queryClient, <MovementProbe />)
    await user.click(screen.getByRole('button', { name: '면접로 이동' }))

    await vi.waitFor(() => {
      expect(screen.getByTestId('movement-result')).toHaveTextContent('success')
    })

    expect(patchCount).toBe(1)
    expect(
      queryClient.getQueryData<{ data: Candidate[] }>(listKey)?.data[0],
    ).toEqual(latestCandidate)
  })

  it('reconcile 후보자 ID가 요청과 다르면 rebase하지 않는다', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    const listKey = candidateQueryKeys.list(200)
    const wrongCandidate: Candidate = {
      ...candidate,
      id: 'candidate-wrong-detail-response',
      email: 'wrong-detail-response@example.com',
      revision: 7,
    }
    let patchCount = 0

    queryClient.setQueryData(listKey, {
      data: [candidate],
      meta: { total: 1 },
    })
    server.use(
      http.patch('*/api/candidates/:candidateId/stage', () => {
        patchCount += 1
        return HttpResponse.json(
          {
            error: {
              code: 'REVISION_CONFLICT',
              message: 'untrusted conflict detail',
              requestId: 'provider-wrong-candidate-conflict',
              retryable: false,
            },
          },
          {
            headers: {
              'x-request-id': 'provider-wrong-candidate-conflict',
            },
            status: 409,
          },
        )
      }),
      http.get('*/api/candidates/:candidateId', () =>
        HttpResponse.json({ data: wrongCandidate }),
      ),
    )

    renderWithProvider(queryClient, <MovementProbe />)
    await user.click(screen.getByRole('button', { name: '면접로 이동' }))

    await vi.waitFor(() => {
      expect(screen.getByTestId('movement-failure')).toHaveTextContent(
        'unknown-outcome',
      )
    })

    expect(patchCount).toBe(1)
    expect(
      queryClient.getQueryData<{ data: Candidate[] }>(listKey)?.data,
    ).toEqual([candidate])
  })
})
