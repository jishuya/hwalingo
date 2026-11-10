import { apiFetch } from './apiFetch'
import { analyticsQuery, type AnalyticsSelection, type AnalyticsRange } from './analytics'
export interface UserProgress {
  totalXp: number
  level: number
  currentLevelXp: number
  nextLevelXp: number | null
  progressPercent: number
  hwarangGrade: { name: string; step: number; maxStep: number; index: number }
  prestigeLevel: number
  savedWords: number
  masteredWords: number
  dueWords: number
  currentStreak: number
  longestStreak: number
  weeklyLearnedWords: number
  weeklyCompletedDays: number
  weeklyGoalDays: number
  masteryDistribution: Array<{ masteryLevel: number; wordCount: number }>
  totalAnswers: number
  correctAnswers: number
  accuracyPercent: number
  recentLearningDays: Array<{ date: string; activityCount: number; earnedXp: number; reviewedWordCount: number }>
  weeklyLearningTrend: Array<{ weekStart: string; activeDays: number; earnedXp: number; reviewedWordCount: number; totalAnswers: number; accuracyPercent: number | null }>
}

export async function getUserProgress(): Promise<UserProgress> {
  const response = await apiFetch('/api/progress/me', { credentials: 'include' })
  if (!response.ok) throw new Error('성장 정보를 불러오지 못했습니다.')
  const result = await response.json() as { progress: UserProgress }
  return result.progress
}

export interface LearningVolume {
  range?: AnalyticsRange
  uniqueWords: number
  days: Array<{ date: string; newAnswers: number; reviewAnswers: number; uniqueWords: number; correctAnswers: number }>
}
export async function getLearningVolume(selection: AnalyticsSelection = {}): Promise<LearningVolume> {
  const response = await apiFetch(`/api/progress/activity?${analyticsQuery(selection)}`, { credentials: 'include' })
  if (!response.ok) throw new Error('학습량을 불러오지 못했어요.')
  return response.json() as Promise<LearningVolume>
}

export interface LearningCalendar {
  days: Array<{ date: string; activityCount: number; earnedXp: number; answerCount: number }>
}
export async function getLearningCalendar(): Promise<LearningCalendar> {
  const response = await apiFetch('/api/progress/calendar', { credentials: 'include' })
  if (!response.ok) throw new Error('학습 잔디를 불러오지 못했어요.')
  return response.json() as Promise<LearningCalendar>
}

export interface GrowingWord {
  vocabularyId: string
  word: string
  meaning: string
  languageCode: string
  beforeLevel: number
  currentLevel: number
  gained: number
}
export async function getGrowingWords(): Promise<{ words: GrowingWord[] }> {
  const response = await apiFetch('/api/progress/word-growth', { credentials: 'include' })
  if (!response.ok) throw new Error('단어 성장 기록을 불러오지 못했어요.')
  return response.json() as Promise<{ words: GrowingWord[] }>
}
