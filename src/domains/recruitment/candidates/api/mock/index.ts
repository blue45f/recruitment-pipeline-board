export {
  CANDIDATE_MOCK_FAILURE_RATE,
  CANDIDATE_MOCK_LATENCY,
  createCandidateHandlers,
  latencyFromRandom,
  shouldSimulateFailure,
} from './createCandidateHandlers'
export {
  CANDIDATE_MOCK_RECEIPT_LIMIT,
  CANDIDATE_MOCK_RECEIPT_TTL_MS,
  createCandidateMockRepository,
  type CandidateMockRepository,
  type CandidateStageCommitResult,
  type CandidateStageReceipt,
  type CandidateStageReceiptLookupResult,
} from './candidateMockRepository'
export {
  CANDIDATE_MOCK_LEGACY_STORAGE_KEY,
  CANDIDATE_MOCK_STORAGE_KEY,
  createBrowserCandidateMockStorage,
  createMemoryCandidateMockStorage,
  type CandidateMockStorage,
} from './candidateMockStorage'
