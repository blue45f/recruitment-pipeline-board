import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/Button'
import {
  CANDIDATE_STAGE_LABELS,
  type CandidateStage,
} from '@/domains/recruitment/candidates/model'
import { cn } from '@/lib/classNames'

type CandidateStageMoveUndoStatus =
  'available' | 'failure' | 'pending' | 'verification-required'

export type CandidateStageMoveUndoNoticeProps = Readonly<{
  candidateName: string
  fromStage: CandidateStage
  onAction: (inputMethod: 'keyboard' | 'pointer') => void
  safeMessage?: string
  status: CandidateStageMoveUndoStatus
  toStage: CandidateStage
}>

const TONE_CLASS_NAMES = {
  available: 'border-[var(--color-success)] bg-[var(--color-success-soft)]',
  failure: 'border-[var(--color-danger)] bg-[var(--color-danger-soft)]',
  pending: 'border-[var(--color-cobalt)] bg-[var(--color-cobalt-soft)]',
  'verification-required':
    'border-[var(--color-warning)] bg-[var(--color-warning-soft)]',
} satisfies Record<CandidateStageMoveUndoStatus, string>

type NoticeContent = Readonly<{
  actionLabel: string
  actionText: string
  message: string
  title: string
}>

function getNoticeContent({
  candidateName,
  fromStage,
  safeMessage,
  status,
  toStage,
}: Omit<CandidateStageMoveUndoNoticeProps, 'onAction'>): NoticeContent {
  const fromStageLabel = CANDIDATE_STAGE_LABELS[fromStage]
  const toStageLabel = CANDIDATE_STAGE_LABELS[toStage]
  const trimmedSafeMessage = safeMessage?.trim()

  switch (status) {
    case 'available':
      return {
        actionLabel: `${candidateName} 후보자를 ${fromStageLabel} 단계로 되돌리기`,
        actionText: '되돌리기',
        message: `${fromStageLabel}에서 ${toStageLabel} 단계로 이동했습니다. 필요하면 한 번 되돌릴 수 있습니다.`,
        title: `${candidateName} 후보자의 단계를 이동했어요`,
      }
    case 'pending':
      return {
        actionLabel: `${candidateName} 후보자를 ${fromStageLabel} 단계로 되돌리는 중`,
        actionText: '되돌리는 중',
        message: `${toStageLabel}에서 ${fromStageLabel} 단계로 되돌리는 중입니다.`,
        title: `${candidateName} 후보자의 단계를 되돌리고 있어요`,
      }
    case 'failure':
      return {
        actionLabel: `${candidateName} 후보자를 ${fromStageLabel} 단계로 되돌리기 다시 시도`,
        actionText: '다시 시도',
        message: `${candidateName} 후보자는 ${toStageLabel} 단계에 유지됩니다. ${trimmedSafeMessage || '잠시 후 다시 시도해 주세요.'}`,
        title: `${candidateName} 후보자의 단계를 되돌리지 못했어요`,
      }
    case 'verification-required':
      return {
        actionLabel: `${candidateName} 후보자의 ${fromStageLabel} 단계 되돌리기 상태 다시 확인`,
        actionText: '상태 다시 확인',
        message: `${fromStageLabel} 단계로 되돌린 결과가 아직 확정되지 않았습니다. ${trimmedSafeMessage || '잠시 후 상태를 다시 확인해 주세요.'}`,
        title: `${candidateName} 후보자의 되돌리기 결과를 확인해 주세요`,
      }
  }
}

function StatusIcon({
  status,
}: Readonly<{ status: CandidateStageMoveUndoStatus }>) {
  switch (status) {
    case 'available':
      return (
        <CheckCircle2
          aria-hidden="true"
          className="size-5 text-[var(--color-success)]"
        />
      )
    case 'pending':
      return (
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin text-[var(--color-cobalt-strong)] motion-reduce:animate-none"
        />
      )
    case 'failure':
      return (
        <AlertTriangle
          aria-hidden="true"
          className="size-5 text-[var(--color-danger)]"
        />
      )
    case 'verification-required':
      return (
        <AlertTriangle
          aria-hidden="true"
          className="size-5 text-[var(--color-warning)]"
        />
      )
  }
}

function ActionIcon({
  status,
}: Readonly<{ status: CandidateStageMoveUndoStatus }>) {
  switch (status) {
    case 'available':
      return <Undo2 aria-hidden="true" className="size-4" />
    case 'pending':
      return (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      )
    case 'failure':
      return <RotateCcw aria-hidden="true" className="size-4" />
    case 'verification-required':
      return <RefreshCw aria-hidden="true" className="size-4" />
  }
}

export function CandidateStageMoveUndoNotice({
  candidateName,
  fromStage,
  onAction,
  safeMessage,
  status,
  toStage,
}: CandidateStageMoveUndoNoticeProps) {
  const titleId = useId()
  const messageId = useId()
  const content = getNoticeContent({
    candidateName,
    fromStage,
    ...(safeMessage === undefined ? {} : { safeMessage }),
    status,
    toStage,
  })
  const isPending = status === 'pending'
  const liveRole =
    status === 'failure' || status === 'verification-required'
      ? 'alert'
      : 'status'

  return (
    <section
      aria-atomic="true"
      aria-describedby={messageId}
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        TONE_CLASS_NAMES[status],
      )}
      data-undo-status={status}
      role={liveRole}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-paper)_72%,transparent)]"
        >
          <StatusIcon status={status} />
        </span>
        <div className="min-w-0">
          <h3
            className="text-sm font-bold [overflow-wrap:anywhere] break-words text-[var(--color-ink)]"
            id={titleId}
          >
            {content.title}
          </h3>
          <p
            className="mt-1 text-sm leading-6 [overflow-wrap:anywhere] break-words text-[var(--color-ink)]"
            id={messageId}
          >
            {content.message}
          </p>
        </div>
      </div>
      <Button
        aria-busy={isPending || undefined}
        aria-label={content.actionLabel}
        className="w-full shrink-0 sm:w-auto"
        disabled={isPending}
        onClick={(event) =>
          onAction(event.detail === 0 ? 'keyboard' : 'pointer')
        }
        size="sm"
        variant="secondary"
      >
        <ActionIcon status={status} />
        {content.actionText}
      </Button>
    </section>
  )
}
