export const MASTERY_LABELS = [
  '처음 만남',
  '기억 시작',
  '단기 기억',
  '익숙함',
  '장기 기억 진입',
  '장기 기억',
  '마스터',
  '완전 마스터',
] as const

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export const REVIEW_RULES = {
  algorithmVersion: 'fixed-v1',
  successIntervalsInDays: [0, 1, 3, 7, 14, 30, 60, 120],
  failureIntervalsInMinutes: [10, 10, 10, 1440, 1440, 4320, 4320, 4320],
  correctScoreGain: 12,
  correctStreakBonusCap: 5,
  incorrectScoreLoss: 15,
  minScore: 0,
  maxScore: 100,
} as const
