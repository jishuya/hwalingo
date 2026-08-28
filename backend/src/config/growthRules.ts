export const XP_BY_MASTERY_LEVEL = [5, 6, 8, 10, 15, 25, 40, 70] as const

export const GROWTH_RULES = {
  maxLevel: 50,
  earlyLevelEnd: 10,
  earlyBaseXp: 50,
  earlyLinearGrowth: 15,
  laterBaseXp: 200,
  laterLinearGrowth: 28,
  laterQuadraticGrowth: 2.2,
  earlyReviewMultiplier: 0.25,
  hintMultiplier: 0.7,
} as const

export const HWARANG_GRADE_RULES = [
  { minLevel: 1, maxLevel: 10, name: '새싹 학습자' },
  { minLevel: 11, maxLevel: 20, name: '화랑 수련생' },
  { minLevel: 21, maxLevel: 30, name: '정예 화랑' },
  { minLevel: 31, maxLevel: 40, name: '화랑 마스터' },
  { minLevel: 41, maxLevel: 50, name: '전설의 화랑' },
] as const
