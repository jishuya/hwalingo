const DAY_IN_MS = 24 * 60 * 60 * 1000

function dateIndex(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MS)
}

export interface StreakSummary {
  currentStreak: number
  longestStreak: number
  weeklyCompletedDays: number
}

export function calculateStreakSummary(learningDates: string[], today: string): StreakSummary {
  const uniqueIndices = [...new Set(learningDates.map(dateIndex))].sort((a, b) => b - a)
  const todayIndex = dateIndex(today)
  const active = new Set(uniqueIndices)
  const currentStart = active.has(todayIndex) ? todayIndex : todayIndex - 1
  let currentStreak = 0
  for (let index = currentStart; active.has(index); index -= 1) currentStreak += 1

  let longestStreak = 0
  let run = 0
  let previous: number | undefined
  for (const index of [...uniqueIndices].reverse()) {
    run = previous !== undefined && index === previous + 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = index
  }

  const todayDate = new Date(todayIndex * DAY_IN_MS)
  const dayOfWeek = todayDate.getUTCDay()
  const mondayIndex = todayIndex - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
  const weeklyCompletedDays = uniqueIndices.filter(index => index >= mondayIndex && index <= todayIndex).length
  return { currentStreak, longestStreak, weeklyCompletedDays }
}
