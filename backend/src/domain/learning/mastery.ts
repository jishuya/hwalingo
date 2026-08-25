import { REVIEW_RULES, type MasteryLevel } from '../../config/learningRules.js'
import { nextReviewAt } from './reviewSchedule.js'

export interface VocabularyProgressState {
  masteryLevel: MasteryLevel
  masteryScore: number
  totalAttempts: number
  correctCount: number
  incorrectCount: number
  correctStreak: number
  incorrectStreak: number
  masteredAt: Date | null
}

export interface ReviewOutcome extends VocabularyProgressState {
  lastReviewedAt: Date
  nextReviewAt: Date
  algorithmVersion: string
}

function clampScore(score: number): number {
  return Math.min(REVIEW_RULES.maxScore, Math.max(REVIEW_RULES.minScore, score))
}

function increaseLevel(level: MasteryLevel): MasteryLevel {
  return Math.min(7, level + 1) as MasteryLevel
}

function decreaseLevel(level: MasteryLevel): MasteryLevel {
  return Math.max(0, level - 1) as MasteryLevel
}

export function calculateReviewOutcome(state: VocabularyProgressState, correct: boolean, reviewedAt = new Date()): ReviewOutcome {
  const masteryLevel = correct ? increaseLevel(state.masteryLevel) : decreaseLevel(state.masteryLevel)
  const correctStreak = correct ? state.correctStreak + 1 : 0
  const incorrectStreak = correct ? 0 : state.incorrectStreak + 1
  const scoreDelta = correct
    ? REVIEW_RULES.correctScoreGain + Math.min(correctStreak - 1, REVIEW_RULES.correctStreakBonusCap)
    : -REVIEW_RULES.incorrectScoreLoss
  const masteredAt = masteryLevel >= 6
    ? state.masteredAt ?? reviewedAt
    : null

  return {
    masteryLevel,
    masteryScore: clampScore(state.masteryScore + scoreDelta),
    totalAttempts: state.totalAttempts + 1,
    correctCount: state.correctCount + (correct ? 1 : 0),
    incorrectCount: state.incorrectCount + (correct ? 0 : 1),
    correctStreak,
    incorrectStreak,
    lastReviewedAt: reviewedAt,
    nextReviewAt: nextReviewAt(masteryLevel, correct, reviewedAt),
    masteredAt,
    algorithmVersion: REVIEW_RULES.algorithmVersion,
  }
}
