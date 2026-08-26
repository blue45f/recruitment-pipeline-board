import { z } from 'zod'

import { candidateRoleSchema, type Candidate } from '../../candidates/model'

export const candidateFiltersSchema = z
  .object({
    query: z.string().max(50),
    role: z.union([z.literal('all'), candidateRoleSchema]),
  })
  .strict()

export type CandidateFilters = z.infer<typeof candidateFiltersSchema>

export const DEFAULT_CANDIDATE_FILTERS = Object.freeze({
  query: '',
  role: 'all',
}) satisfies CandidateFilters

export function normalizeCandidateQuery(query: string) {
  return query.trim().length > 0
    ? query.trimStart()
    : DEFAULT_CANDIDATE_FILTERS.query
}

export function filterCandidates(
  candidates: readonly Candidate[],
  filters: CandidateFilters,
): Candidate[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('ko-KR')

  return candidates.filter((candidate) => {
    const matchesQuery = candidate.name
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedQuery)
    const matchesRole =
      filters.role === 'all' || candidate.role === filters.role

    return matchesQuery && matchesRole
  })
}

export function readCandidateFilters(searchParams: URLSearchParams) {
  const query = candidateFiltersSchema.shape.query.safeParse(
    searchParams.get('query') ?? DEFAULT_CANDIDATE_FILTERS.query,
  )
  const role = candidateFiltersSchema.shape.role.safeParse(
    searchParams.get('role') ?? DEFAULT_CANDIDATE_FILTERS.role,
  )

  return {
    query: query.success
      ? normalizeCandidateQuery(query.data)
      : DEFAULT_CANDIDATE_FILTERS.query,
    role: role.success ? role.data : DEFAULT_CANDIDATE_FILTERS.role,
  } satisfies CandidateFilters
}

export function writeCandidateFilters(filters: CandidateFilters) {
  const searchParams = new URLSearchParams()

  const normalizedQuery = normalizeCandidateQuery(filters.query)

  if (normalizedQuery.length > 0) {
    searchParams.set('query', normalizedQuery)
  }

  if (filters.role !== 'all') {
    searchParams.set('role', filters.role)
  }

  return searchParams
}
