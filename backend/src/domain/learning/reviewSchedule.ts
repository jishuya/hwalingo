import { REVIEW_RULES, type MasteryLevel } from '../../config/learningRules.js'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const MINUTE_IN_MS = 60 * 1000

export function nextReviewAt(level: MasteryLevel, correct: boolean, reviewedAt: Date): Date {
  const delay = correct
    ? REVIEW_RULES.successIntervalsInDays[level] * DAY_IN_MS
    : REVIEW_RULES.failureIntervalsInMinutes[level] * MINUTE_IN_MS
  return new Date(reviewedAt.getTime() + delay)
}
