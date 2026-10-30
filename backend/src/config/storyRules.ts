export const STORY_LENGTH_RULES = {
  short: { minimumSentences: 3, maximumSentences: 4 },
  medium: { minimumSentences: 5, maximumSentences: 6 },
  long: { minimumSentences: 7, maximumSentences: 9 },
} as const

export const STORY_DIFFICULTY_RULES = {
  easy: { cefr: 'A2', guidance: 'Use frequent everyday vocabulary, concrete events, short simple clauses, and basic connectors. Avoid idioms and complex subordinate clauses.' },
  normal: { cefr: 'B1-B2', guidance: 'Use natural intermediate vocabulary, connected narration, and a moderate mix of subordinate clauses, reasons, contrasts, and relative clauses. Avoid dense academic wording.' },
  hard: { cefr: 'C1', guidance: 'Use precise and varied vocabulary, nuanced implications, natural idiomatic expressions, and varied complex sentence structures. Keep the narrative coherent and avoid unnecessary obscurity.' },
} as const

export function countStorySentences(text: string, languageCode: string): number {
  return [...new Intl.Segmenter(languageCode, { granularity: 'sentence' }).segment(text)]
    .filter(part => part.segment.trim()).length
}

export function validateStorySentences(sentences: unknown, length: keyof typeof STORY_LENGTH_RULES, languageCode: string): asserts sentences is string[] {
  const rule = STORY_LENGTH_RULES[length]
  if (!Array.isArray(sentences) || sentences.length < rule.minimumSentences || sentences.length > rule.maximumSentences
    || sentences.some(sentence => typeof sentence !== 'string' || !sentence.trim() || countStorySentences(sentence, languageCode) !== 1)
    || countStorySentences(sentences.join(' '), languageCode) !== sentences.length) {
    throw new Error('요청한 문장 수에 맞는 스토리를 생성하지 못했어요. 다시 시도해주세요.')
  }
}
