import { defaultRangeExtractor, type Range } from '@tanstack/react-virtual'

export function extractRangeWithPinnedCandidates(
  range: Range,
  pinnedCandidateIndexes: readonly number[],
) {
  const renderedIndexes = new Set(defaultRangeExtractor(range))

  for (const candidateIndex of pinnedCandidateIndexes) {
    if (candidateIndex >= 0) {
      renderedIndexes.add(candidateIndex)
    }
  }

  return [...renderedIndexes].sort((left, right) => left - right)
}
