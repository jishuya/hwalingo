import { GROWTH_RULES } from '../../config/growthRules.js'

export interface LevelProgress {
  level: number
  currentLevelXp: number
  nextLevelXp: number | null
  progressPercent: number
}

export function xpRequiredForNextLevel(level: number): number {
  if (level < GROWTH_RULES.earlyLevelEnd) {
    return GROWTH_RULES.earlyBaseXp + (level - 1) * GROWTH_RULES.earlyLinearGrowth
  }
  const laterLevel = level - GROWTH_RULES.earlyLevelEnd
  return Math.round(GROWTH_RULES.laterBaseXp + laterLevel * GROWTH_RULES.laterLinearGrowth + laterLevel ** 2 * GROWTH_RULES.laterQuadraticGrowth)
}

export function calculateLevelProgress(totalXp: number): LevelProgress {
  let level = 1
  let remainingXp = Math.max(0, totalXp)
  while (level < GROWTH_RULES.maxLevel) {
    const required = xpRequiredForNextLevel(level)
    if (remainingXp < required) {
      return { level, currentLevelXp: remainingXp, nextLevelXp: required, progressPercent: Math.round((remainingXp / required) * 100) }
    }
    remainingXp -= required
    level += 1
  }
  return { level: GROWTH_RULES.maxLevel, currentLevelXp: remainingXp, nextLevelXp: null, progressPercent: 100 }
}
