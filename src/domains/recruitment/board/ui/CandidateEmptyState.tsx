import { UserRoundPlus } from 'lucide-react'

export function CandidateEmptyState() {
  return (
    <section
      aria-live="polite"
      className="grid min-h-[42.125rem] place-items-center border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)] px-6 py-16 text-center"
      role="status"
    >
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-cobalt-soft)] text-[var(--color-cobalt-strong)]">
          <UserRoundPlus aria-hidden="true" className="size-6" />
        </span>
        <p className="font-data mt-5 text-xs font-semibold tracking-[0.16em] text-[var(--color-cobalt-strong)] uppercase">
          Empty pipeline
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.025em] text-[var(--color-ink)]">
          등록된 후보자가 없습니다
        </h2>
        <p className="mt-3 text-sm leading-6 break-keep text-[var(--color-muted)]">
          후보자 데이터가 추가되면 채용 단계별로 이곳에 표시됩니다.
        </p>
      </div>
    </section>
  )
}
