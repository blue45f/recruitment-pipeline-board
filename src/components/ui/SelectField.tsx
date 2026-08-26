import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Label, Select } from 'radix-ui'
import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/classNames'

type SelectOption = Readonly<{
  disabled?: boolean
  label: string
  value: string
}>

export type SelectFieldProps = Readonly<{
  className?: string
  defaultValue?: string
  description?: ReactNode
  disabled?: boolean
  error?: ReactNode
  id?: string
  label: ReactNode
  name?: string
  onValueChange?: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  required?: boolean
  triggerClassName?: string
  value?: string
}>

export function SelectField({
  className,
  defaultValue,
  description,
  disabled,
  error,
  id,
  label,
  name,
  onValueChange,
  options,
  placeholder = '선택해 주세요',
  required,
  triggerClassName,
  value,
}: SelectFieldProps) {
  const generatedId = useId()
  const triggerId = id ?? `select-field-${generatedId}`
  const labelId = `${triggerId}-label`
  const descriptionId = description ? `${triggerId}-description` : undefined
  const errorId = error ? `${triggerId}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ')

  return (
    <div className={cn('grid content-start gap-2', className)}>
      <Label.Root
        className="w-fit text-sm font-semibold text-[var(--color-ink)]"
        htmlFor={triggerId}
        id={labelId}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[var(--color-coral)]">
            *
          </span>
        ) : null}
      </Label.Root>
      <Select.Root
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(name === undefined ? {} : { name })}
        {...(onValueChange === undefined ? {} : { onValueChange })}
        {...(required === undefined ? {} : { required })}
        {...(value === undefined ? {} : { value })}
      >
        <Select.Trigger
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          aria-labelledby={labelId}
          className={cn(
            'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-paper)] px-3.5 py-2.5 text-left text-sm text-[var(--color-ink)] shadow-[0_1px_2px_rgba(24,32,51,0.04)] transition-[border-color,box-shadow] outline-none hover:border-[var(--color-muted)] focus-visible:border-[var(--color-brand)] focus-visible:ring-3 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-65 data-[placeholder]:text-[var(--color-muted)] motion-reduce:transition-none',
            error && 'border-[var(--color-danger)]',
            triggerClassName,
          )}
          id={triggerId}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon asChild>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-60 max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-paper)] p-1 shadow-[0_16px_48px_rgba(24,32,51,0.16)] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-safe:transition-opacity"
            collisionPadding={12}
            position="popper"
            sideOffset={8}
          >
            <Select.ScrollUpButton className="flex h-7 items-center justify-center text-[var(--color-muted)]">
              <ChevronUp aria-hidden="true" className="size-4" />
            </Select.ScrollUpButton>
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  className="relative flex min-h-11 cursor-default items-center rounded-lg py-2 pr-8 pl-3 text-sm text-[var(--color-ink)] outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--color-cobalt-soft)] data-[highlighted]:text-[var(--color-brand-strong)]"
                  {...(option.disabled === undefined
                    ? {}
                    : { disabled: option.disabled })}
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2.5 inline-flex items-center text-[var(--color-brand)]">
                    <Check aria-hidden="true" className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex h-7 items-center justify-center text-[var(--color-muted)]">
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
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
