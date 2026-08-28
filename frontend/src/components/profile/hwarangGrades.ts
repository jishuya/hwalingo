export interface HwarangGrade {
  name: string
  description: string
  start: number
  end: number
}

export const HWARANG_GRADES: HwarangGrade[] = [
  { name: '새싹 학습자', description: '화랑이의 첫 번째 성장 모습', start: 1, end: 10 },
  { name: '화랑 수련생', description: '화랑이의 두 번째 성장 모습', start: 11, end: 20 },
  { name: '정예 화랑', description: '화랑이의 세 번째 성장 모습', start: 21, end: 30 },
  { name: '화랑 마스터', description: '화랑이의 네 번째 성장 모습', start: 31, end: 40 },
  { name: '전설의 화랑', description: '화랑이의 마지막 성장 모습', start: 41, end: 50 },
]

export function hwarangGradeForLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(50, Math.floor(level)))
  const index = Math.min(HWARANG_GRADES.length - 1, Math.floor((safeLevel - 1) / 10))
  const grade = HWARANG_GRADES[index]
  return { ...grade, index, step: safeLevel - grade.start + 1, maxStep: 10 }
}
