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

export const RANK_RULES = [
  { minLevel: 1, name: 'Cadet' },
  { minLevel: 10, name: 'Scout' },
  { minLevel: 20, name: 'Ranger' },
  { minLevel: 30, name: 'Vanguard' },
  { minLevel: 40, name: 'Elite' },
  { minLevel: 50, name: 'Hwarang Master' },
] as const
