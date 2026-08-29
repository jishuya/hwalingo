export const AI_RULES = {
  sentenceAnalysis: { timeoutMs: 30_000, maxRetries: 1, maxOutputTokens: 4_000 },
  sentenceVocabulary: { timeoutMs: 30_000, maxRetries: 1, maxOutputTokens: 4_000 },
  sentenceParaphrases: { timeoutMs: 15_000, maxRetries: 0, maxOutputTokens: 1_400 },
  storyGeneration: { timeoutMs: 40_000, maxRetries: 1, maxOutputTokens: 4_000 },
  vocabularyAnalysis: { timeoutMs: 15_000, maxRetries: 0, maxOutputTokens: 500 },
  vocabularyImage: { timeoutMs: 60_000, maxRetries: 0 },
  reasoningEffort: 'minimal',
  cache: {
    sentenceAnalysisTtlMs: 7 * 24 * 60 * 60 * 1_000,
    sentenceVocabularyTtlMs: 7 * 24 * 60 * 60 * 1_000,
    sentenceParaphrasesTtlMs: 30 * 24 * 60 * 60 * 1_000,
    vocabularyAnalysisTtlMs: 30 * 24 * 60 * 60 * 1_000,
    storyTtlMs: 7 * 24 * 60 * 60 * 1_000,
  },
} as const
