import { Check, Layers3, Route, ShieldCheck } from 'lucide-react'

const foundationItems = [
  {
    icon: Route,
    label: '명확한 화면 경계',
    description: '라우팅과 오류 처리를 독립된 계층에서 관리합니다.',
  },
  {
    icon: Layers3,
    label: '분리된 상태 책임',
    description: '서버 상태와 화면 상태가 각자의 역할에 집중합니다.',
  },
  {
    icon: ShieldCheck,
    label: '자동화된 품질 기준',
    description: '타입, 접근성, 테스트와 빌드 검증을 한곳에 연결했습니다.',
  },
] as const

export function RecruitmentFoundation() {
  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[var(--color-surface)] px-5 py-8 text-[var(--color-ink)] sm:px-8 sm:py-12 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[32rem] max-w-6xl bg-[radial-gradient(circle_at_24%_18%,rgba(95,180,136,0.2),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(255,195,117,0.22),transparent_35%)]"
      />

      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-between rounded-[2rem] border border-white/80 bg-white/72 p-6 shadow-[0_32px_90px_rgba(39,63,48,0.12)] backdrop-blur-xl sm:min-h-[calc(100svh-6rem)] sm:p-10 lg:p-14">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-[0_8px_24px_rgba(27,117,82,0.25)]"
            >
              <Layers3 size={20} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                Recruit Flow
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Hiring workspace
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Foundation
          </span>
        </header>

        <section
          aria-labelledby="foundation-title"
          className="grid items-end gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-20"
        >
          <div>
            <p className="mb-5 text-sm font-semibold tracking-[0.16em] text-[var(--color-brand)] uppercase">
              Candidate journey
            </p>
            <h1
              id="foundation-title"
              className="max-w-3xl text-[clamp(3rem,8vw,6.6rem)] leading-[0.95] font-semibold tracking-[-0.075em] text-balance"
            >
              채용의 흐름을
              <br />더 선명하게
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
              지원자의 여정을 차분하게 살피고, 다음 판단에 집중할 수 있는 작업
              환경을 준비했습니다.
            </p>
          </div>

          <ul
            aria-label="프로젝트 기반 구성"
            className="space-y-3 rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-3 shadow-[0_20px_50px_rgba(34,55,42,0.08)]"
          >
            {foundationItems.map(({ description, icon: Icon, label }) => (
              <li
                key={label}
                className="flex gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-emerald-900/5 hover:bg-white"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--color-brand)] shadow-sm ring-1 ring-emerald-950/5"
                >
                  <Icon size={19} strokeWidth={2} />
                </span>
                <div>
                  <p className="font-semibold tracking-[-0.015em]">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700"
            >
              <Check size={13} strokeWidth={3} />
            </span>
            채용 보드 기능은 다음 단계에서 연결됩니다.
          </p>
          <p className="text-xs tracking-[0.08em] text-[var(--color-muted)] uppercase">
            Built for focused decisions
          </p>
        </footer>
      </div>
    </main>
  )
}
