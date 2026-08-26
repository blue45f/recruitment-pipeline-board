import type { ComponentProps } from 'react'
import type { VariantProps } from 'class-variance-authority'

import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/classNames'

type ButtonProps = Omit<ComponentProps<'button'>, 'type'> &
  VariantProps<typeof buttonVariants> & {
    type?: 'button' | 'submit'
  }

export function Button({
  className,
  type = 'button',
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      type={type === 'submit' ? 'submit' : 'button'}
      {...props}
    />
  )
}
