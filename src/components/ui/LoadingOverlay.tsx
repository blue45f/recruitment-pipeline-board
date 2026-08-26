import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/classNames'

export type LoadingOverlayProps = Readonly<{
  children?: ReactNode
  className?: string
  containerClassName?: string
  label?: string
  visible?: boolean
}>

export function LoadingOverlay({
  children,
  className,
  containerClassName,
  label = '불러오는 중입니다',
  visible = true,
}: LoadingOverlayProps) {
  const status = visible ? (
    <div
      aria-atomic="true"
      aria-label={label}
      aria-live="polite"
      className={cn(
        'absolute inset-0 z-40 grid min-h-28 place-items-center rounded-[inherit] bg-[color-mix(in_srgb,var(--color-paper)_88%,transparent)] p-6 backdrop-blur-[1px]',
        className,
      )}
      role="status"
    >
      <span className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] shadow-[0_8px_24px_rgba(24,32,51,0.12)]">
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin text-[var(--color-brand)] motion-reduce:animate-none"
        />
        {label}
      </span>
    </div>
  ) : null

  if (children === undefined) {
    return status
  }

  return (
    <div aria-busy={visible} className={cn('relative', containerClassName)}>
      <div aria-hidden={visible || undefined} inert={visible || undefined}>
        {children}
      </div>
      {status}
    </div>
  )
}
