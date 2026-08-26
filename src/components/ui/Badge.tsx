import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/classNames'

const badgeVariants = cva(
  'inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral:
          'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
        info: 'border-[var(--color-cobalt)] bg-[var(--color-cobalt-soft)] text-[var(--color-cobalt-strong)]',
        attention:
          'border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
        success:
          'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]',
        danger:
          'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
