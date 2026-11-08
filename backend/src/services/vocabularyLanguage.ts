import type { LanguageCode, VocabularyAnalysis } from './openai.js'

const scripts: Record<LanguageCode, RegExp> = {
  en: /\p{Script=Latin}/u,
  fr: /\p{Script=Latin}/u,
  de: /\p{Script=Latin}/u,
  es: /\p{Script=Latin}/u,
  zh: /\p{Script=Han}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
}

const allowedLetters: Record<LanguageCode, RegExp> = {
  en: /\p{Script=Latin}/gu,
  fr: /\p{Script=Latin}/gu,
  de: /\p{Script=Latin}/gu,
  es: /\p{Script=Latin}/gu,
  zh: /\p{Script=Han}/gu,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/gu,
  ko: /\p{Script=Hangul}/gu,
}

/** Check the entire example, rather than accepting a single target-language word. */
export function isExampleInLearningLanguage(value: string, language: string): boolean {
  if (!Object.hasOwn(scripts, language)) return false
  const code = language as LanguageCode
  const normalized = value.normalize('NFC').trim()
  return scripts[code].test(normalized)
    && !/\p{Letter}/u.test(normalized.replace(allowedLetters[code], ''))
}

export function isVocabularyInLearningLanguage(
  item: Pick<VocabularyAnalysis, 'word' | 'exampleSentence'>,
  learningSentence: string,
  language: LanguageCode,
): boolean {
  const word = item.word.normalize('NFC').trim()
  if (!word || !scripts[language].test(word) || !isExampleInLearningLanguage(item.exampleSentence, language)) return false
  // East Asian learning words must not silently contain an English source word.
  if (['zh', 'ja', 'ko'].includes(language) && /\p{Script=Latin}/u.test(word)) return false
  if (['en', 'fr', 'de', 'es'].includes(language) && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(word)) return false
  // Lemmas can differ from inflected surface forms; require exact occurrence for Chinese only.
  return language !== 'zh' || learningSentence.normalize('NFC').includes(word)
}

export class VocabularyLanguageError extends Error {
  constructor() {
    super('핵심 어휘를 학습언어에 맞게 생성하지 못했어요. 잠시 후 다시 분석해 주세요.')
    this.name = 'VocabularyLanguageError'
  }
}
