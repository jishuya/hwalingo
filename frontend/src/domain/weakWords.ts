export interface WeakWord {
  vocabularyId: string
  progress: { totalAttempts: number; incorrectCount: number; lastReviewedAt: string | null }
}

/** Progress counters exclude retries, matching the first-answer learning policy. */
export function rankWeakWords<T extends WeakWord>(words: T[], limit = 5): T[] {
  return words.filter(word => word.progress.totalAttempts > 0 && word.progress.incorrectCount > 0)
    .sort((a, b) => b.progress.incorrectCount - a.progress.incorrectCount
      || b.progress.incorrectCount / b.progress.totalAttempts - a.progress.incorrectCount / a.progress.totalAttempts
      || Date.parse(a.progress.lastReviewedAt ?? '1970-01-01') - Date.parse(b.progress.lastReviewedAt ?? '1970-01-01')
      || a.vocabularyId.localeCompare(b.vocabularyId, 'en', { numeric: true }))
    .slice(0, limit)
}
