import { createContext, useContext, useSyncExternalStore } from 'react'

import type { CandidateMovementCoordinator } from './CandidateMovementCoordinator'

export const CandidateMovementContext =
  createContext<CandidateMovementCoordinator | null>(null)

export function useCandidateMovementCoordinator() {
  const coordinator = useContext(CandidateMovementContext)

  if (coordinator === null) {
    throw new Error(
      'useCandidateMovementCoordinator must be used within CandidateMovementProvider.',
    )
  }

  return coordinator
}

export function useCandidateMovementSnapshot() {
  const coordinator = useCandidateMovementCoordinator()

  return useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  )
}
