export interface UserProgress {
  totalXp: number
  level: number
  currentLevelXp: number
  nextLevelXp: number | null
  progressPercent: number
  rank: string
  prestigeLevel: number
  savedWords: number
  masteredWords: number
  dueWords: number
  currentStreak: number
  longestStreak: number
  weeklyCompletedDays: number
  weeklyGoalDays: number
  timezone: string
}

export async function getUserProgress(): Promise<UserProgress> {
  const response = await fetch('/api/progress/me', { credentials: 'include' })
  if (!response.ok) throw new Error('성장 정보를 불러오지 못했습니다.')
  const result = await response.json() as { progress: UserProgress }
  return result.progress
}
