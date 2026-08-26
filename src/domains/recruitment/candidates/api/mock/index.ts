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
  CANDIDATE_STAGE_OPERATION_KINDS,
  createCandidateMockRepository,
  type CandidateMockRepository,
  type CandidateStageCommitResult,
  type CandidateStageOperationKind,
  type CandidateStageReceipt,
  type CandidateStageReceiptLookupResult,
} from './candidateMockRepository'
export {
  CANDIDATE_MOCK_LEGACY_STORAGE_KEY,
  CANDIDATE_MOCK_PREVIOUS_STORAGE_KEY,
  CANDIDATE_MOCK_STORAGE_KEY,
  createBrowserCandidateMockStorage,
  createMemoryCandidateMockStorage,
  type CandidateMockStorage,
} from './candidateMockStorage'
