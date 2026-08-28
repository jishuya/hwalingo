import { HWARANG_GRADE_RULES } from '../../config/growthRules.js'

export interface HwarangGrade {
  name: string
  step: number
  maxStep: number
  index: number
}

export function hwarangGradeForLevel(level: number): HwarangGrade {
  const safeLevel = Math.max(1, Math.min(50, Math.floor(level)))
  const index = Math.min(HWARANG_GRADE_RULES.length - 1, Math.floor((safeLevel - 1) / 10))
  const rule = HWARANG_GRADE_RULES[index]
  return { name: rule.name, step: safeLevel - rule.minLevel + 1, maxStep: 10, index }
}
