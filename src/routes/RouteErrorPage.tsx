import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export function RouteErrorPage() {
  const error = useRouteError()
  const title = isRouteErrorResponse(error)
    ? `${error.status} · 요청한 화면을 찾지 못했어요`
    : '화면을 불러오지 못했어요'

  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-surface)] p-6">
      <section
        aria-labelledby="route-error-title"
        className="w-full max-w-md rounded-3xl border border-[var(--color-line)] bg-white p-8 text-center shadow-xl"
      >
        <p className="text-sm font-semibold text-[var(--color-brand)]">
          Recruit Flow
        </p>
        <h1
          id="route-error-title"
          className="mt-3 text-2xl font-semibold tracking-[-0.04em]"
        >
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          주소를 확인하거나 처음 화면으로 돌아가 주세요.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white outline-none hover:bg-[var(--color-brand-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2"
          to="/"
        >
          처음으로
        </Link>
      </section>
    </main>
  )
}
