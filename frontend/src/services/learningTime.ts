export type LearningActivity = 'analysis' | 'vocabulary' | 'quiz' | 'story'
export interface TimeEvent { id: string; activity: LearningActivity; startedAt: string; endedAt: string }
export interface LearningTimeSummary { measurementStartedAt: string; days: Array<{ date: string; seconds: number }> }
const key = (userId: string) => `hwalingo-learning-time:${userId}`
function read(userId: string): TimeEvent[] {
  try { return JSON.parse(localStorage.getItem(key(userId)) ?? '[]') as TimeEvent[] } catch { return [] }
}
function write(userId: string, events: TimeEvent[]) {
  // Keep at most 30 days / 10,000 pending chunks; unavailable storage must not break studying.
  try { localStorage.setItem(key(userId), JSON.stringify(events.filter(e => Date.parse(e.startedAt) > Date.now() - 30 * 86400_000).slice(-10_000))) } catch { /* Storage unavailable. */ }
}
async function storageLock<T>(userId: string, action: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request(key(userId), action) : action()
}
export async function queueLearningTime(userId: string, event: TimeEvent) {
  await storageLock(userId, () => write(userId, [...read(userId), event]))
}
let sending = false
export async function flushLearningTime(userId: string) {
  if (sending) return
  const events = read(userId).slice(0, 100)
  if (!events.length) return
  sending = true
  try {
    const response = await fetch('/api/learning-time/events', {
      method: 'POST', credentials: 'include', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, events }),
    })
    if (response.ok || response.status === 400) {
      const ids = new Set(events.map(event => event.id))
      await storageLock(userId, () => write(userId, read(userId).filter(event => !ids.has(event.id))))
    }
  } catch { /* Retry from persistent queue when online or on next heartbeat. */ }
  finally { sending = false }
}
export async function getLearningTime(): Promise<LearningTimeSummary> {
  const response = await fetch('/api/learning-time/me', { credentials: 'include' })
  if (!response.ok) throw new Error('학습 시간을 불러오지 못했어요.')
  return response.json() as Promise<LearningTimeSummary>
}
