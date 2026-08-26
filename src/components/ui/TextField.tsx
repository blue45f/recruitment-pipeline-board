import { Label } from 'radix-ui'
import { useId, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/classNames'

export type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  containerClassName?: string
  description?: ReactNode
  error?: ReactNode
  id?: string
  label: ReactNode
}

export function TextField({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className,
  containerClassName,
  description,
  error,
  id,
  label,
  required,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? `text-field-${generatedId}`
  const descriptionId = description ? `${inputId}-description` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [ariaDescribedBy, descriptionId, errorId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('grid content-start gap-2', containerClassName)}>
      <Label.Root
        className="w-fit text-sm font-semibold text-[var(--color-ink)]"
        htmlFor={inputId}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[var(--color-coral)]">
            *
          </span>
        ) : null}
      </Label.Root>
      <input
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : ariaInvalid}
        className={cn(
          'min-h-11 w-full rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-paper)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] shadow-[0_1px_2px_rgba(24,32,51,0.04)] transition-[border-color,box-shadow] outline-none placeholder:text-[var(--color-muted)] hover:border-[var(--color-muted)] focus-visible:border-[var(--color-brand)] focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-65 motion-reduce:transition-none',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        id={inputId}
        required={required}
        {...props}
      />
      {description ? (
        <p
          className="text-xs leading-5 text-[var(--color-muted)]"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          className="text-xs leading-5 font-medium text-[var(--color-danger)]"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
