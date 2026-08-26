import { GROWTH_RULES, XP_BY_MASTERY_LEVEL } from '../../config/growthRules.js'
import type { MasteryLevel } from '../../config/learningRules.js'

export interface XpCalculationInput {
  correct: boolean
  masteryLevelBefore: MasteryLevel
  totalAttemptsBefore: number
  nextReviewAtBefore: Date
  reviewedAt: Date
  usedHint: boolean
}

export function calculateQuizXp(input: XpCalculationInput): number {
  if (!input.correct) return 0
  const baseXp = XP_BY_MASTERY_LEVEL[input.totalAttemptsBefore === 0 ? 0 : input.masteryLevelBefore]
  const dueMultiplier = input.totalAttemptsBefore > 0 && input.reviewedAt < input.nextReviewAtBefore
    ? GROWTH_RULES.earlyReviewMultiplier
    : 1
  const hintMultiplier = input.usedHint ? GROWTH_RULES.hintMultiplier : 1
  return Math.max(1, Math.round(baseXp * dueMultiplier * hintMultiplier))
}
