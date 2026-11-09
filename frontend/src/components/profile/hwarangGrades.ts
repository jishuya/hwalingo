export interface HwarangGrade {
  name: string
  description: string
  start: number
  end: number
}

export const HWARANG_GRADES: HwarangGrade[] = [
  { name: '새싹 화랑이', description: '이제 막 모험을 시작한 꼬마 화랑이.\n작은 발걸음에 커다란 호기심을 담았어요.', start: 1, end: 10 },
  { name: '화랑 수련생', description: '매일 조금씩 단단해지는 수련생 화랑이.\n넘어져도 툭툭 털고 다시 일어나요.', start: 11, end: 20 },
  { name: '정예 화랑', description: '어엿한 실력과 자신감을 갖춘 화랑이.\n친구들과 함께라면 모험이 두렵지 않아요.', start: 21, end: 30 },
  { name: '화랑 마스터', description: '오랜 수련으로 여유까지 갖춘 화랑이.\n든든한 모습으로 친구들의 길잡이가 돼요.', start: 31, end: 40 },
  { name: '전설의 화랑', description: '수많은 모험 끝에 전설이 된 화랑이.\n작은 시작이 얼마나 멀리 갈 수 있는지 보여줘요.', start: 41, end: 50 },
]

export function hwarangGradeForLevel(level: number) {
  const safeLevel = Math.max(1, Math.min(50, Math.floor(level)))
  const index = Math.min(HWARANG_GRADES.length - 1, Math.floor((safeLevel - 1) / 10))
  const grade = HWARANG_GRADES[index]
  return { ...grade, index, step: safeLevel - grade.start + 1, maxStep: 10 }
}
