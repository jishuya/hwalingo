import type { LanguageCode } from '../services/analysis'

const FRENCH_MARKERS = new Set([
  'au', 'aux', 'avec', 'bonjour', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en',
  'est', 'et', 'être', 'il', 'je', 'la', 'le', 'les', 'mais', 'merci', 'mon', 'nous',
  'pas', 'pour', 'que', 'qui', 'sont', 'sur', 'tu', 'un', 'une', 'vous',
])

/** Detects the five languages supported by sentence analysis. */
export function detectLanguage(text: string): LanguageCode | undefined {
  const normalized = text.trim().normalize('NFC')
  if (!normalized) return undefined

  if (/\p{Script=Hangul}/u.test(normalized)) return 'ko'
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(normalized)) return 'ja'
  if (/\p{Script=Han}/u.test(normalized)) return 'zh'

  const latinText = normalized.toLocaleLowerCase()
  if (!/\p{Script=Latin}/u.test(latinText)) return undefined
  if (/[àâæçéèêëîïôœùûüÿ]/u.test(latinText)) return 'fr'

  const words = latinText.match(/\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*/gu) ?? []
  const frenchScore = words.reduce((score, word) => {
    const parts = word.split(/['’]/u)
    const markerMatches = parts.filter(part => FRENCH_MARKERS.has(part)).length
    const elisionBonus = /^(?:c|d|j|l|m|n|qu|s|t)['’]/u.test(word) ? 1 : 0
    return score + markerMatches + elisionBonus
  }, 0)

  return frenchScore >= (words.length <= 2 ? 2 : 1) ? 'fr' : 'en'
}
