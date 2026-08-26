import type { FallbackProps } from 'react-error-boundary'

import { Button } from '@/components/ui/Button'

export function AppErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-surface)] p-6">
      <section
        aria-labelledby="app-error-title"
        className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-white p-8 text-center shadow-xl"
      >
        <p className="text-sm font-semibold text-rose-700">화면 오류</p>
        <h1
          id="app-error-title"
          className="mt-3 text-2xl font-semibold tracking-[-0.04em]"
        >
          화면을 표시하지 못했어요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          잠시 후 다시 시도해 주세요. 같은 문제가 이어지면 페이지를 새로고침해
          주세요.
        </p>
        <Button className="mt-6" onClick={resetErrorBoundary}>
          다시 시도
        </Button>
      </section>
    </main>
  )
}
