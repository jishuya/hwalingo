export interface AnalyticsSelection { from?: string; to?: string; period?: 'all' }
export interface AnalyticsRange { start: string; end: string; today: string; grain: 'day' | 'month' | 'year' }
export function analyticsQuery(selection: AnalyticsSelection = {}) { return new URLSearchParams(Object.entries(selection).filter(([,value]) => value !== undefined) as [string,string][]).toString() }
export interface LearningInsights {
  range: AnalyticsRange
  activities: Array<{ type: string; count: number }>
  languages: Array<{ language: string; saved: number; learned: number; mastered: number; answers: number }>
  growth: { openingXp: number; days: Array<{ date: string; earnedXp: number; totalXp: number; level: number; levelsGained: number; grade: string }> }
  weekdays: Array<{ weekday: number; averageAnswers: number; averageSeconds: number | null; maxAnswers: number; maxSeconds: number | null; activeDays: number; observedDays: number; measuredDays: number }>
}
export async function getLearningInsights(selection: AnalyticsSelection): Promise<LearningInsights> {
  const response = await fetch(`/api/progress/insights?${analyticsQuery(selection)}`, { credentials: 'include' })
  if (!response.ok) throw new Error('학습 통계를 불러오지 못했어요.')
  return response.json() as Promise<LearningInsights>
}
export function formatAnalyticsDate(date: string, grain = 'day') {
  if (grain === 'year') return `${date.slice(0,4)}년`
  if (grain === 'month') return `${date.slice(0,4)}.${date.slice(5,7)}`
  return `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`
}
