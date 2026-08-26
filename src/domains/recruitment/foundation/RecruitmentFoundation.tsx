import { Check, Layers3, Route, ShieldCheck } from 'lucide-react'

const foundationItems = [
  {
    icon: Route,
    index: 'R01',
    label: '명확한 화면 경계',
    description: '라우팅과 오류 처리를 독립된 계층에서 관리합니다.',
  },
  {
    icon: Layers3,
    index: 'R02',
    label: '분리된 상태 책임',
    description: '서버 상태와 화면 상태가 각자의 역할에 집중합니다.',
  },
  {
    icon: ShieldCheck,
    index: 'R03',
    label: '자동화된 품질 기준',
    description: '타입, 접근성, 테스트와 빌드 검증을 한곳에 연결했습니다.',
  },
] as const

export function RecruitmentFoundation() {
  return (
    <main className="min-h-svh bg-[var(--color-surface)] px-4 py-4 text-[var(--color-ink)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-[90rem] flex-col overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper)] shadow-[var(--shadow-panel)] sm:min-h-[calc(100svh-3rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center bg-[var(--color-cobalt)] text-white"
            >
              <Layers3 size={18} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-bold tracking-[-0.01em] text-[var(--color-ink)]">
                RECRUIT FLOW
              </p>
              <p className="font-data text-[0.65rem] text-[var(--color-muted)]">
                HIRING OPERATIONS / 2026
              </p>
            </div>
          </div>

          <span className="inline-flex min-h-8 items-center gap-2 border border-[var(--color-line)] bg-[var(--color-fog)] px-3 text-xs font-semibold text-[var(--color-muted)]">
            <span className="size-1.5 bg-[var(--color-success)]" />
            SYSTEM READY
          </span>
        </header>

        <section
          aria-labelledby="foundation-title"
          className="grid flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]"
        >
          <div className="flex min-h-[32rem] flex-col justify-between border-b border-[var(--color-line)] p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-14">
            <div className="flex items-start justify-between gap-6">
              <p className="font-data text-xs tracking-[0.12em] text-[var(--color-cobalt)]">
                FILE / FOUNDATION
              </p>
              <span
                aria-hidden="true"
                className="mt-1 h-12 w-1 bg-[var(--color-coral)]"
              />
            </div>

            <div>
              <p className="mb-4 text-sm font-semibold tracking-[0.16em] text-[var(--color-cobalt)] uppercase">
                Candidate pipeline
              </p>
              <h1
                id="foundation-title"
                className="max-w-4xl text-[clamp(3rem,7vw,6.4rem)] leading-[0.92] font-semibold tracking-[-0.07em] text-balance"
              >
                채용의 흐름을
                <br />더 선명하게
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 break-keep text-[var(--color-muted)] sm:text-lg sm:leading-8">
                지원자의 여정을 차분하게 살피고, 다음 판단에 집중할 수 있는 운영
                화면을 준비하고 있습니다.
              </p>
            </div>
          </div>

          <div className="flex flex-col bg-[var(--color-fog)]">
            <div className="border-b border-[var(--color-line)] px-6 py-6 sm:px-8">
              <p className="font-data text-[0.65rem] tracking-[0.12em] text-[var(--color-muted)]">
                READINESS INDEX
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                준비된 기반
              </h2>
            </div>
            <ol aria-label="프로젝트 기반 구성" className="flex-1">
              {foundationItems.map(
                ({ description, icon: Icon, index, label }) => (
                  <li
                    key={label}
                    className="grid grid-cols-[3.25rem_1fr] border-b border-[var(--color-line)] bg-[var(--color-paper)] transition-colors hover:bg-[var(--color-cobalt-soft)]"
                  >
                    <span className="font-data border-r border-[var(--color-line)] px-3 py-6 text-[0.65rem] font-semibold text-[var(--color-cobalt)] sm:px-4">
                      {index}
                    </span>
                    <div className="flex gap-4 px-4 py-5 sm:px-6 sm:py-6">
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center border border-[var(--color-line)] bg-[var(--color-fog)] text-[var(--color-cobalt)]"
                      >
                        <Icon size={17} strokeWidth={2} />
                      </span>
                      <div>
                        <p className="font-semibold tracking-[-0.015em]">
                          {label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                          {description}
                        </p>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ol>
            <div className="m-5 border-l-4 border-[var(--color-cobalt)] bg-[var(--color-paper)] p-4 sm:m-6">
              <p
                role="status"
                className="flex items-start gap-3 text-sm font-medium"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-5 shrink-0 place-items-center bg-[var(--color-success-soft)] text-[var(--color-success)]"
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                공용 UI와 채용 보드 기능을 순서대로 연결하고 있습니다.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[var(--color-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-sm text-[var(--color-muted)]">
            일관된 판단을 위한 채용 운영 화면
          </p>
          <p className="font-data text-[0.65rem] tracking-[0.08em] text-[var(--color-muted)]">
            STATUS / IN PROGRESS
          </p>
        </footer>
      </div>
    </main>
  )
}
