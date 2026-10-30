import type { LanguageCode } from '../services/analysis'
import type { Vocabulary } from '../services/vocabulary'

export const STORY_RECOMMENDATION_RULES = { count: 5, review: 3, new: 1, familiar: 1, recentDays: 7, familiarMinimumLevel: 3 } as const

type Candidate = Pick<Vocabulary, 'vocabularyId' | 'languageCode' | 'progress' | 'lastStoryUsedAt'>

export function recommendStoryWords<T extends Candidate>(candidates: T[], options: { language?: LanguageCode; now?: number; random?: () => number; previousIds?: readonly string[] } = {}): T[] {
  const now = options.now ?? Date.now()
  const random = options.random ?? Math.random
  const previous = new Set(options.previousIds ?? [])
  const rules = STORY_RECOMMENDATION_RULES
  const unique = [...new Map(candidates.map(word => [word.vocabularyId, word])).values()]
  const due = (word: T) => word.progress.totalAttempts > 0 && Date.parse(word.progress.nextReviewAt) <= now
  const fresh = (word: T) => word.progress.totalAttempts === 0
  const familiar = (word: T) => !fresh(word) && !due(word) && word.progress.masteryLevel >= rules.familiarMinimumLevel
  const recent = (word: T) => word.lastStoryUsedAt && Date.parse(word.lastStoryUsedAt) >= now - rules.recentDays * 86400000 ? 1 : 0
  const shuffled = [...unique]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  const languages = [...new Set(shuffled.map(word => word.languageCode))]
  const group = (language: LanguageCode) => shuffled.filter(word => word.languageCode === language)
  const coverage = (words: T[]) => Math.min(rules.review, words.filter(due).length)
    + Math.min(rules.new, words.filter(fresh).length) + Math.min(rules.familiar, words.filter(familiar).length)
  const viable = languages.filter(language => group(language).length >= rules.count)
  const language = options.language ?? (viable.length ? viable : languages).sort((a, b) =>
    coverage(group(b)) - coverage(group(a)) || group(b).length - group(a).length)[0]
  const source = shuffled.filter(word => word.languageCode === language)
  const rank = (words: T[], review = false) => [...words].sort((a, b) => Number(previous.has(a.vocabularyId)) - Number(previous.has(b.vocabularyId))
    || recent(a) - recent(b)
    || (review ? Date.parse(a.progress.nextReviewAt) - Date.parse(b.progress.nextReviewAt) : 0)
    || a.progress.masteryLevel - b.progress.masteryLevel)
  const selected: T[] = []
  const used = new Set<string>()
  const add = (words: T[], count: number) => {
    for (const word of words) {
      if (count <= 0 || selected.length >= rules.count) break
      if (used.has(word.vocabularyId)) continue
      used.add(word.vocabularyId); selected.push(word); count--
    }
  }
  const reviews = rank(source.filter(due), true)
  const newWords = rank(source.filter(fresh))
  const familiarWords = rank(source.filter(familiar))
  add(reviews, rules.review)
  add(newWords, rules.new)
  add(familiarWords, rules.familiar)
  add([...reviews, ...newWords, ...familiarWords, ...rank(source)], rules.count - selected.length)
  // If quotas leave the exact same set, rotate one word when any alternative exists.
  if (selected.length === rules.count && selected.every(word => previous.has(word.vocabularyId))) {
    const alternative = rank(source).find(word => !used.has(word.vocabularyId))
    if (alternative) selected[selected.length - 1] = alternative
  }
  return selected
}
