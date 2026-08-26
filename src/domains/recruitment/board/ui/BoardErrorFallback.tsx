import { AlertTriangle, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ApiError } from '@/domains/recruitment/candidates/api'

export type BoardErrorFallbackProps = Readonly<{
  error: unknown
  onRetry: (inputMethod: 'keyboard' | 'pointer') => void
}>

function getSafeErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.safeMessage
    : '후보자 정보를 표시하지 못했습니다.'
}

export function BoardErrorFallback({
  error,
  onRetry,
}: BoardErrorFallbackProps) {
  return (
    <section
      aria-labelledby="board-error-title"
      className="grid min-h-[42.125rem] place-items-center border border-[var(--color-line)] bg-[var(--color-paper)] p-6"
      role="alert"
    >
      <div className="max-w-md text-center">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto mb-4 size-8 text-[var(--color-danger)]"
        />
        <h2
          className="text-lg font-semibold tracking-[-0.02em]"
          id="board-error-title"
        >
          보드를 불러오지 못했어요
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {getSafeErrorMessage(error)}
        </p>
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
      </div>
    </section>
  )
}
