import type { UserProgress } from '../services/progress'

const weekDayLabels = ['월', '화', '수', '목', '금', '토', '일']

export function getCurrentWeek(learningDays: UserProgress['recentLearningDays']) {
  const todayText = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const today = new Date(`${todayText}T00:00:00Z`)
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7))
  const activityByDate = new Map(learningDays.map(day => [day.date, day]))

  return weekDayLabels.map((label, index) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    const dateText = date.toISOString().slice(0, 10)
    return { label, date: dateText, activity: activityByDate.get(dateText) }
  })
}

