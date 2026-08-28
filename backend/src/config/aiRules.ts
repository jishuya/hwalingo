export const AI_RULES = {
  sentenceAnalysis: { timeoutMs: 30_000, maxRetries: 1, maxOutputTokens: 8_000 },
  storyGeneration: { timeoutMs: 40_000, maxRetries: 1, maxOutputTokens: 4_000 },
  advancedQuiz: { timeoutMs: 8_000, maxRetries: 0, maxOutputTokensPerItem: 1_200 },
  wrongAnswerFeedback: { timeoutMs: 10_000, maxRetries: 0, maxOutputTokens: 500 },
  vocabularyAnalysis: { timeoutMs: 15_000, maxRetries: 0, maxOutputTokens: 1_000 },
  vocabularyImage: { timeoutMs: 60_000, maxRetries: 0 },
  reasoningEffort: 'minimal',
  cache: {
    sentenceAnalysisTtlMs: 7 * 24 * 60 * 60 * 1_000,
    vocabularyAnalysisTtlMs: 30 * 24 * 60 * 60 * 1_000,
  },
} as const
