import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw } from 'lucide-react'
import type { Ref } from 'react'
import { useController, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import {
  CANDIDATE_ROLES,
  CANDIDATE_ROLE_LABELS,
  type CandidateListSize,
} from '@/domains/recruitment/candidates/model'

import {
  candidateFiltersSchema,
  DEFAULT_CANDIDATE_FILTERS,
  normalizeCandidateQuery,
  type CandidateFilters as CandidateFilterValues,
} from '../model'

const ROLE_OPTIONS = [
  { label: '전체 직무', value: 'all' },
  ...CANDIDATE_ROLES.map((role) => ({
    label: CANDIDATE_ROLE_LABELS[role],
    value: role,
  })),
] as const

const LIST_SIZE_OPTIONS = [
  { label: '후보자 200명', value: '200' },
  { label: '후보자 1,000명 · 가상 목록', value: '1000' },
  { label: '데이터 없음 · 빈 상태', value: '0' },
] as const

function parseListSize(value: string): CandidateListSize | undefined {
  switch (value) {
    case '0':
      return 0
    case '200':
      return 200
    case '1000':
      return 1_000
    default:
      return undefined
  }
}

export type CandidateFiltersProps = Readonly<{
  filters: CandidateFilterValues
  listSize: CandidateListSize
  onFiltersChange: (filters: CandidateFilterValues) => void
  onListSizeChange: (listSize: CandidateListSize) => void
  searchInputRef?: Ref<HTMLInputElement>
}>

export function CandidateFilters({
  filters,
  listSize,
  onFiltersChange,
  onListSizeChange,
  searchInputRef,
}: CandidateFiltersProps) {
  const { control, reset } = useForm<CandidateFilterValues>({
    resolver: zodResolver(candidateFiltersSchema),
    values: filters,
  })
  const queryController = useController({ control, name: 'query' })
  const roleController = useController({ control, name: 'role' })
  const hasFilters = filters.query.trim().length > 0 || filters.role !== 'all'

  return (
    <form
      aria-label="후보자 검색과 필터"
      className="grid gap-4 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-4 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-[minmax(16rem,1.5fr)_minmax(11rem,0.75fr)_minmax(13rem,0.9fr)_auto] xl:items-start"
      onSubmit={(event) => event.preventDefault()}
      role="search"
    >
      <TextField
        {...queryController.field}
        autoComplete="off"
        description="이름 일부를 입력하면 현재 목록 안에서 바로 찾습니다."
        label="후보자 검색"
        maxLength={50}
        onChange={(event) => {
          const nextFilters = candidateFiltersSchema.safeParse({
            query: normalizeCandidateQuery(event.currentTarget.value),
            role: roleController.field.value,
          })

          if (nextFilters.success) {
            queryController.field.onChange(nextFilters.data.query)
            onFiltersChange(nextFilters.data)
          }
        }}
        placeholder="이름을 입력하세요"
        ref={searchInputRef}
        type="search"
      />

      <SelectField
        label="직무"
        name={roleController.field.name}
        onValueChange={(value) => {
          const nextFilters = candidateFiltersSchema.safeParse({
            query: queryController.field.value,
            role: value,
          })

          if (nextFilters.success) {
            roleController.field.onChange(nextFilters.data.role)
            onFiltersChange(nextFilters.data)
          }
        }}
        options={ROLE_OPTIONS}
        value={roleController.field.value}
      />

      <SelectField
        label="표시할 데이터"
        name="candidate-list-size"
        onValueChange={(value) => {
          const nextListSize = parseListSize(value)

          if (nextListSize !== undefined) {
            onListSizeChange(nextListSize)
          }
        }}
        options={LIST_SIZE_OPTIONS}
        value={String(listSize)}
      />

      <Button
        className="disabled:text-[var(--color-muted)] disabled:opacity-100 md:min-h-[2.875rem] md:self-end md:justify-self-end xl:mt-7 xl:self-start"
        disabled={!hasFilters}
        onClick={() => {
          reset(DEFAULT_CANDIDATE_FILTERS)
          onFiltersChange(DEFAULT_CANDIDATE_FILTERS)
        }}
        variant="ghost"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        필터 초기화
      </Button>
    </form>
  )
}
