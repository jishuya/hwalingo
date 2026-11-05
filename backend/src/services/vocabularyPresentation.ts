/** Japanese readings use kana rather than IPA, romaji, or kanji. */
export function isKanaReading(value: string): boolean {
  return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)
    && /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(value)
}

/** Etymology is optional; every explanatory sentence must use polite ~요 speech. */
export function isPoliteEtymology(value: string): boolean {
  if (!value.trim()) return true
  const sentences = value.trim().split(/(?<=[.!?。])\s+/u)
  return sentences.every(sentence => /요[.!?。…]*[”’"')\]]*$/u.test(sentence.trim()))
}

/** Meanings must be Korean; numbers and punctuation are harmless. */
export function isKoreanExplanation(value: string, allowQuotedTerms = false): boolean {
  const prose = allowQuotedTerms
    ? value.replace(/'[^'\n]{1,50}'|"[^"\n]{1,50}"|‘[^’\n]{1,50}’|“[^”\n]{1,50}”|「[^」\n]{1,50}」/gu, term =>
      /\p{Script=Hangul}/u.test(term) ? term : '')
    : value
  return /[가-힣]/u.test(prose)
    && !/\p{Letter}/u.test(prose.replace(/\p{Script=Hangul}/gu, ''))
}

export class VocabularyExplanationError extends Error {
  constructor() {
    super('핵심 어휘의 한국어 설명을 완성하지 못했어요. 잠시 후 다시 분석해 주세요.')
    this.name = 'VocabularyExplanationError'
  }
}
