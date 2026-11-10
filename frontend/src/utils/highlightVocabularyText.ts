import { createElement } from 'react'

export function highlightVocabularyText(text: string, word: string, className: string, memoryTip = false) {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return text
  // Keep Latin words whole while allowing vocabulary in unspaced languages.
  const term = /[\p{Script=Latin}]/u.test(word)
    ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`
    : escaped
  const quoted = memoryTip ? '|[“「『‘][^”」』’\\n]+[”」』’]|"[^"\\n]+"|\'[^\'\\n]+\'' : ''
  const pattern = new RegExp(`(${term}${quoted})`, 'giu')
  return text.split(pattern).map((part, index) => index % 2 === 1
    ? createElement('mark', { className, key: index }, part)
    : part)
}

