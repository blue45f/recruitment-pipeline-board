import {
  createCandidateHandlers,
  createCandidateMockRepository,
  type CandidateMockStorage,
} from '@/domains/recruitment/candidates/api/mock'

type CreateHandlersOptions = {
  storage: CandidateMockStorage
}

export function createHandlers({ storage }: CreateHandlersOptions) {
  const repository = createCandidateMockRepository({ storage })

  return {
    handlers: createCandidateHandlers({ repository }),
    reset: () => repository.reset(),
  }
}
