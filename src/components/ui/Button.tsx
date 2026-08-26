import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/classNames'

type ButtonSharedProps = Omit<ComponentProps<'button'>, 'disabled' | 'type'> &
  VariantProps<typeof buttonVariants>

type NativeButtonProps = ButtonSharedProps & {
  asChild?: false
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  type?: 'button' | 'submit'
}

type ChildButtonProps = ButtonSharedProps & {
  asChild: true
  disabled?: never
  loading?: never
  loadingLabel?: never
  type?: never
}

export type ButtonProps = NativeButtonProps | ChildButtonProps

export function Button({
  'aria-busy': ariaBusy,
  'aria-label': ariaLabel,
  asChild = false,
  children,
  className,
  disabled,
  loading = false,
  loadingLabel = '처리 중',
  size,
  type = 'button',
  variant,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ size, variant }), className)

  if (asChild) {
    if (disabled || loading) {
      throw new Error(
        'Button의 asChild 모드에서는 disabled와 loading을 사용할 수 없습니다.',
      )
    }

    return (
      <Slot.Root
        aria-busy={ariaBusy || undefined}
        aria-label={ariaLabel}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      {...props}
      aria-busy={loading || ariaBusy || undefined}
      aria-label={loading ? loadingLabel : ariaLabel}
      className={classes}
      disabled={disabled || loading}
      type={type === 'submit' ? 'submit' : 'button'}
    >
      <span className={cn('contents', loading && 'invisible')}>{children}</span>
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className="absolute size-4 animate-spin motion-reduce:animate-none"
        />
      ) : null}
    </button>
  )
}
