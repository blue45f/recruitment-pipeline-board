import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:translate-y-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-brand)] text-white shadow-[0_1px_2px_rgba(24,32,51,0.18)] hover:bg-[var(--color-brand-strong)]',
        secondary:
          'border border-[var(--color-line-strong)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[0_1px_2px_rgba(24,32,51,0.06)] hover:border-[var(--color-brand)] hover:bg-[var(--color-cobalt-soft)]',
        ghost:
          'text-[var(--color-ink)] hover:bg-[var(--color-surface)] hover:text-[var(--color-brand-strong)]',
        danger:
          'bg-[var(--color-danger)] text-white shadow-[0_1px_2px_rgba(24,32,51,0.18)] hover:brightness-90',
      },
      size: {
        sm: 'min-h-11 rounded-lg px-3 py-1.5 text-xs',
        default: 'min-h-11 px-5 py-2.5',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'primary',
    },
  },
)
