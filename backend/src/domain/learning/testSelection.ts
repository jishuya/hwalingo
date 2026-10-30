import { QUIZ_RULES, type SelectionGroup } from '../../config/quizRules.js'
import type { MasteryLevel } from '../../config/learningRules.js'

export interface TestCandidate {
  vocabularyId: string
  masteryLevel: MasteryLevel
  totalAttempts: number
  correctCount: number
  incorrectCount: number
  nextReviewAt: Date
  lastReviewedAt: Date | null
}

export interface SelectedCandidate extends TestCandidate {
  selectionGroup: SelectionGroup
}

function shuffled<T>(items: T[]): T[] {
  return items.map(value => ({ value, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map(item => item.value)
}

export function selectTestCandidates(candidates: TestCandidate[], requestedCount: number, now = new Date()): SelectedCandidate[] {
  const due = candidates.filter(item => item.totalAttempts > 0 && item.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
  const fresh = shuffled(candidates.filter(item => item.totalAttempts === 0))
  const reviewTarget = Math.floor(requestedCount * QUIZ_RULES.selectionWeights.due)
  const newTarget = requestedCount - reviewTarget
  const selected: SelectedCandidate[] = [
    ...due.slice(0, reviewTarget).map(item => ({ ...item, selectionGroup: 'due' as const })),
    ...fresh.slice(0, newTarget).map(item => ({ ...item, selectionGroup: 'new' as const })),
  ]
  // Fill a shortage from the other group without pulling future reviews forward.
  const remaining = [
    ...due.slice(reviewTarget).map(item => ({ ...item, selectionGroup: 'due' as const })),
    ...fresh.slice(newTarget).map(item => ({ ...item, selectionGroup: 'new' as const })),
  ]
  return [...selected, ...remaining].slice(0, requestedCount)
}

// Additional sessions only use unseen-today words that are ready to study.
export function selectAdditionalTestCandidates(candidates: TestCandidate[], requestedCount: number, answeredToday: ReadonlySet<string>, now = new Date()): SelectedCandidate[] {
  const available = candidates.filter(item => !answeredToday.has(item.vocabularyId))
  const due = available.filter(item => item.totalAttempts > 0 && item.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
  const fresh = shuffled(available.filter(item => item.totalAttempts === 0))
  return [
    ...due.map(item => ({ ...item, selectionGroup: 'due' as const })),
    ...fresh.map(item => ({ ...item, selectionGroup: 'new' as const })),
  ].slice(0, requestedCount)
}

export function selectIncorrectTestCandidates(candidates: TestCandidate[], requestedCount: number, now = new Date()): SelectedCandidate[] {
  return candidates.filter(item => item.incorrectCount > 0).sort((a, b) => {
    const aDue = a.nextReviewAt <= now
    const bDue = b.nextReviewAt <= now
    return Number(bDue) - Number(aDue)
      || (aDue && bDue ? a.nextReviewAt.getTime() - b.nextReviewAt.getTime() : 0)
      || b.incorrectCount / Math.max(1, b.totalAttempts) - a.incorrectCount / Math.max(1, a.totalAttempts)
      || (a.lastReviewedAt?.getTime() ?? 0) - (b.lastReviewedAt?.getTime() ?? 0)
  }).slice(0, requestedCount).map(item => ({ ...item, selectionGroup: 'weak' as const }))
}
