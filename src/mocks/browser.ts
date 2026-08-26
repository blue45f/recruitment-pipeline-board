import { setupWorker } from 'msw/browser'

import { createBrowserCandidateMockStorage } from '@/domains/recruitment/candidates/api/mock'
import { createHandlers } from '@/mocks/handlers'

const browserMockApi = createHandlers({
  storage: createBrowserCandidateMockStorage(),
})

export const worker = setupWorker(...browserMockApi.handlers)
