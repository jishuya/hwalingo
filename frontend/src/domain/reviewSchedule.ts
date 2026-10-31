export interface ScheduledWord {
  progress: { totalAttempts: number; nextReviewAt: string }
}
const learningDate = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date)

export function buildReviewSchedule<T extends ScheduledWord>(words: T[], now: Date) {
  const today = learningDate(now)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index)
    return { date: date.toISOString().slice(0, 10), words: [] as T[] }
  })
  const overdue: T[] = []
  const dueNow: T[] = []
  const byDate = new Map(days.map(day => [day.date, day.words]))
  for (const word of words) {
    if (word.progress.totalAttempts <= 0) continue
    const next = new Date(word.progress.nextReviewAt)
    if (!Number.isFinite(next.getTime())) continue
    const date = learningDate(next)
    if (next <= now) dueNow.push(word)
    if (date < today) overdue.push(word)
    else byDate.get(date)?.push(word)
  }
  const sort = (list: T[]) => list.sort((a, b) => Date.parse(a.progress.nextReviewAt) - Date.parse(b.progress.nextReviewAt))
  days.forEach(day => sort(day.words))
  return { today, days, overdue: sort(overdue), dueNow: sort(dueNow) }
}
