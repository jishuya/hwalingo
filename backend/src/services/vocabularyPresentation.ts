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
