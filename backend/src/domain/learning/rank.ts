import { RANK_RULES } from '../../config/growthRules.js'

export function rankForLevel(level: number): string {
  return [...RANK_RULES].reverse().find(rank => level >= rank.minLevel)?.name ?? RANK_RULES[0].name
}
