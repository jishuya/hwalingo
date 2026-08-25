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

function targetCounts(total: number): Record<Exclude<SelectionGroup, 'fallback'>, number> {
  const due = Math.floor(total * QUIZ_RULES.selectionWeights.due)
  const newlyLearned = Math.floor(total * QUIZ_RULES.selectionWeights.new)
  const mastered = Math.floor(total * QUIZ_RULES.selectionWeights.mastered)
  return { due, new: newlyLearned, mastered, weak: total - due - newlyLearned - mastered }
}

export function selectTestCandidates(candidates: TestCandidate[], requestedCount: number, now = new Date()): SelectedCandidate[] {
  const limit = Math.min(requestedCount, candidates.length)
  const targets = targetCounts(limit)
  const selected: SelectedCandidate[] = []
  const used = new Set<string>()

  const groups: Record<Exclude<SelectionGroup, 'fallback'>, TestCandidate[]> = {
    due: candidates.filter(item => item.totalAttempts > 0 && item.masteryLevel < 6 && item.nextReviewAt <= now)
      .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime()),
    new: shuffled(candidates.filter(item => item.totalAttempts === 0)),
    mastered: candidates.filter(item => item.masteryLevel >= 6)
      .sort((a, b) => (a.lastReviewedAt?.getTime() ?? 0) - (b.lastReviewedAt?.getTime() ?? 0)),
    weak: candidates.filter(item => item.incorrectCount > 0)
      .sort((a, b) => (b.incorrectCount / Math.max(1, b.totalAttempts)) - (a.incorrectCount / Math.max(1, a.totalAttempts))),
  }

  const add = (items: TestCandidate[], count: number, selectionGroup: SelectionGroup) => {
    for (const item of items) {
      if (selected.length >= limit || count <= 0) break
      if (used.has(item.vocabularyId)) continue
      selected.push({ ...item, selectionGroup })
      used.add(item.vocabularyId)
      count -= 1
    }
  }

  add(groups.due, targets.due, 'due')
  add(groups.new, targets.new, 'new')
  add(groups.mastered, targets.mastered, 'mastered')
  add(groups.weak, targets.weak, 'weak')

  const fallback = candidates
    .filter(item => !used.has(item.vocabularyId))
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
  add(fallback, limit - selected.length, 'fallback')
  return selected
}
