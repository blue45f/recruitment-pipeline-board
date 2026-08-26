import { setupServer } from 'msw/node'

import { createMemoryCandidateMockStorage } from '@/domains/recruitment/candidates/api/mock'
import { createHandlers } from '@/mocks/handlers'

const serverMockApi = createHandlers({
  storage: createMemoryCandidateMockStorage(),
})

export const server = setupServer(...serverMockApi.handlers)
export const resetServerMockData = serverMockApi.reset
