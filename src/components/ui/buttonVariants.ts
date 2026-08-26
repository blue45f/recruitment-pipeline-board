import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-strong)]',
        secondary:
          'border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-panel)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)
