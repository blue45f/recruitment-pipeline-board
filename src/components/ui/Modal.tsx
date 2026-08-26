import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/classNames'

type DialogContentProps = ComponentProps<typeof Dialog.Content>

export type ModalProps = Readonly<{
  children: ReactNode
  className?: string
  closeLabel?: string
  defaultOpen?: boolean
  description: ReactNode
  footer?: ReactNode
  onCloseAutoFocus?: DialogContentProps['onCloseAutoFocus']
  onOpenChange?: (open: boolean) => void
  open?: boolean
  title: ReactNode
  trigger?: ReactElement
}>

export function Modal({
  children,
  className,
  closeLabel = '닫기',
  defaultOpen,
  description,
  footer,
  onCloseAutoFocus,
  onOpenChange,
  open,
  title,
  trigger,
}: ModalProps) {
  return (
    <Dialog.Root
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
      {...(open === undefined ? {} : { open })}
    >
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-70 bg-[rgba(24,32,51,0.48)] opacity-0 backdrop-blur-[2px] transition-opacity data-[state=open]:opacity-100 motion-reduce:transition-none" />
        <Dialog.Content
          {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
          className={cn(
            'fixed top-1/2 left-1/2 z-80 flex max-h-[min(46rem,calc(100dvh-2rem))] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 scale-[0.98] flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink)] opacity-0 shadow-[0_24px_80px_rgba(24,32,51,0.24)] transition-[opacity,transform] outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none',
            className,
          )}
        >
          <header className="relative border-b border-[var(--color-line)] px-6 py-5 pr-16">
            <Dialog.Title className="text-lg font-bold tracking-[-0.02em] text-[var(--color-ink)]">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm leading-6 text-[var(--color-muted)]">
              {description}
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button
                aria-label={closeLabel}
                className="absolute top-3.5 right-3.5"
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-4">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
