// Korean story translations must contain Hangul and must not echo Chinese/Japanese prose.
export function isKoreanStoryTranslation(value: unknown): value is string {
  return typeof value === 'string' && /[가-힣]/u.test(value)
    && !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)
}
