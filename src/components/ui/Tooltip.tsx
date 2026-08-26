import { Tooltip as RadixTooltip } from 'radix-ui'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

import { cn } from '@/lib/classNames'

type TooltipContentProps = ComponentProps<typeof RadixTooltip.Content>

export type TooltipProps = Readonly<{
  align?: TooltipContentProps['align']
  children: ReactElement
  className?: string
  content: ReactNode
  delayDuration?: number
  side?: TooltipContentProps['side']
  sideOffset?: number
}>

export function Tooltip({
  align = 'center',
  children,
  className,
  content,
  delayDuration,
  side = 'top',
  sideOffset = 8,
}: TooltipProps) {
  return (
    <RadixTooltip.Root
      {...(delayDuration === undefined ? {} : { delayDuration })}
    >
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          align={align}
          className={cn(
            'z-90 max-w-64 rounded-lg bg-[var(--color-ink)] px-3 py-2 text-xs leading-5 font-medium text-white shadow-[0_8px_24px_rgba(24,32,51,0.2)] data-[state=closed]:opacity-0 data-[state=delayed-open]:opacity-100 motion-safe:transition-opacity',
            className,
          )}
          collisionPadding={8}
          side={side}
          sideOffset={sideOffset}
        >
          {content}
          <RadixTooltip.Arrow className="fill-[var(--color-ink)]" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
