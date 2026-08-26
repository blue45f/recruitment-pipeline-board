const BOOT_COLUMN_KEYS = ['01', '02', '03', '04', '05'] as const

export function BootLoadingPage() {
  return (
    <main
      aria-busy="true"
      className="min-h-svh bg-[var(--color-surface)] px-3 py-3 text-[var(--color-ink)] sm:px-5 sm:py-5 lg:px-7"
    >
      <div className="mx-auto min-h-[calc(100svh-1.5rem)] max-w-[104rem] overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper)] shadow-[var(--shadow-panel)] sm:min-h-[calc(100svh-2.5rem)]">
        <header className="flex flex-col gap-4 border-b border-[var(--color-line)] px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="font-data grid size-10 shrink-0 place-items-center bg-[var(--color-cobalt)] text-xs font-bold text-white"
            >
              RF
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
          aria-label="후보자 보드를 준비하는 중입니다"
          aria-live="polite"
          role="status"
        >
          <span className="sr-only">후보자 보드를 준비하는 중입니다.</span>
          <div
            aria-hidden="true"
            className="grid gap-4 border-b border-[var(--color-line)] px-4 py-4 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-[minmax(16rem,1.5fr)_minmax(11rem,0.75fr)_minmax(13rem,0.9fr)_auto] xl:items-start"
          >
            <span className="h-[6.25rem] animate-pulse rounded-xl bg-[var(--color-fog)] motion-reduce:animate-none" />
            <span className="h-[4.5rem] animate-pulse rounded-xl bg-[var(--color-fog)] motion-reduce:animate-none" />
            <span className="h-[4.5rem] animate-pulse rounded-xl bg-[var(--color-fog)] motion-reduce:animate-none" />
            <span className="h-[2.875rem] animate-pulse rounded-xl bg-[var(--color-fog)] motion-reduce:animate-none md:self-end md:justify-self-end xl:mt-7 xl:self-start" />
          </div>

          <div
            aria-hidden="true"
            className="overflow-hidden bg-[var(--color-fog)] px-3 py-5 sm:px-5 lg:px-7 lg:py-7"
          >
            <span className="mb-4 block h-5 w-48 animate-pulse rounded bg-[var(--color-line)] motion-reduce:animate-none" />
            <div className="flex min-w-max gap-3 sm:gap-4">
              {BOOT_COLUMN_KEYS.map((key) => (
                <span
                  className="block h-[39rem] w-72 shrink-0 animate-pulse rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] motion-reduce:animate-none lg:w-[17rem] xl:w-[15.5rem] 2xl:w-[17rem]"
                  key={key}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
