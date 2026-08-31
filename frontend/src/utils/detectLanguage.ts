import type { LanguageCode } from '../services/analysis'

const FRENCH_MARKERS = new Set([
  'au', 'aux', 'avec', 'bonjour', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en',
  'est', 'et', 'être', 'il', 'je', 'la', 'le', 'les', 'mais', 'merci', 'mon', 'nous',
  'pas', 'pour', 'que', 'qui', 'sont', 'sur', 'tu', 'un', 'une', 'vous',
  'suis',
])
const STRONG_FRENCH_MARKERS = new Set(['avec', 'aux', 'bonjour', 'des', 'être', 'merci', 'nous', 'pour', 'suis', 'une', 'vous'])

export interface LanguageDetection {
  language?: LanguageCode
  dominantLanguage?: LanguageCode
  confidence: number
  status: 'empty' | 'confirmed' | 'mixed' | 'low-confidence'
}

const characterCount = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

function detectLatinLanguage(text: string): LanguageCode {
  const latinText = text.toLocaleLowerCase()
  if (/[àâæçéèêëîïôœùûüÿ]/u.test(latinText)) return 'fr'

  const words = latinText.match(/\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*/gu) ?? []
  if (words.some(word => STRONG_FRENCH_MARKERS.has(word))) return 'fr'
  const frenchScore = words.reduce((score, word) => {
    const parts = word.split(/['’]/u)
    const markerMatches = parts.filter(part => FRENCH_MARKERS.has(part)).length
    const elisionBonus = /^(?:c|d|j|l|m|n|qu|s|t)['’]/u.test(word) ? 1 : 0
    return score + markerMatches + elisionBonus
  }, 0)

  return frenchScore >= Math.max(2, Math.ceil(words.length * 0.2)) ? 'fr' : 'en'
}

/** Detects a dominant supported language while preserving ambiguous mixed-language input. */
export function getLanguageDetection(text: string): LanguageDetection {
  const normalized = text.trim().normalize('NFC')
  if (!normalized) return { confidence: 0, status: 'empty' }

  const hangul = characterCount(normalized, /\p{Script=Hangul}/gu)
  const kana = characterCount(normalized, /[\p{Script=Hiragana}\p{Script=Katakana}]/gu)
  const han = characterCount(normalized, /\p{Script=Han}/gu)
  const latin = characterCount(normalized, /\p{Script=Latin}/gu)
  const scores = new Map<LanguageCode, number>()
  if (hangul) scores.set('ko', hangul)
  if (kana) scores.set('ja', kana + han)
  else if (han) scores.set('zh', han)
  if (latin) scores.set(detectLatinLanguage(normalized), latin)

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1])
  const [first, second] = ranked
  if (!first) return { confidence: 0, status: 'low-confidence' }

  const total = ranked.reduce((sum, [, score]) => sum + score, 0)
  const confidence = first[1] / total
  const gap = (first[1] - (second?.[1] ?? 0)) / total
  const dominantLanguage = first[0]
  const isHanOnly = han > 0 && hangul === 0 && kana === 0 && latin === 0
  const hasEnoughEvidence = total >= 2 && (!isHanOnly || han >= 4)
  if (!hasEnoughEvidence) return { dominantLanguage, confidence, status: 'low-confidence' }
  if (confidence < 0.7 || gap < 0.2) return { dominantLanguage, confidence, status: 'mixed' }
  return { language: dominantLanguage, dominantLanguage, confidence, status: 'confirmed' }
}

export function detectLanguage(text: string): LanguageCode | undefined {
  return getLanguageDetection(text).language
}
