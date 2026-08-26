interface BootErrorPageProps {
  onRetry?: () => void
}

function reloadPage() {
  window.location.reload()
}

export function BootErrorPage({ onRetry = reloadPage }: BootErrorPageProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-surface)] p-6">
      <section
        aria-labelledby="boot-error-title"
        aria-live="assertive"
        className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-white p-8 text-center shadow-xl"
      >
        <p className="text-sm font-semibold text-rose-700">시작 오류</p>
        <h1
          id="boot-error-title"
          className="mt-3 text-2xl font-semibold tracking-[-0.04em]"
        >
          앱을 준비하지 못했어요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          네트워크 연결을 확인한 뒤 페이지를 다시 불러와 주세요.
        </p>
        <button
          className="mt-6 min-h-11 rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white outline-none hover:bg-[var(--color-brand-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
          onClick={onRetry}
          type="button"
        >
          다시 불러오기
        </button>
      </section>
    </main>
  )
}
