import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../services/auth'
import { flushLearningTime, queueLearningTime, type LearningActivity } from '../../services/learningTime'

/** Mount only while learning content is available. Each chunk is capped to avoid suspended-tab inflation. */
export default function LearningTimer({ activity, enabled }: { activity: LearningActivity; enabled: boolean }) {
  const { data } = useQuery({ queryKey: ['auth', 'me'], queryFn: getCurrentUser })
  const userId = data?.user.id
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!enabled || !userId) return
    const idleMs = activity === 'quiz' ? 120_000 : 180_000
    let lastActivity = performance.now()
    let lastTick = lastActivity
    let lastWall = Date.now()
    let foreground = document.visibilityState === 'visible' && document.hasFocus()
    let pendingStart: number | undefined
    let pendingEnd = 0
    let elapsed = 0
    const persist = () => {
      if (pendingStart !== undefined && pendingEnd > pendingStart) {
        queueLearningTime(userId, { id: crypto.randomUUID(), activity, startedAt: new Date(pendingStart).toISOString(), endedAt: new Date(pendingEnd).toISOString() }).then(() => flushLearningTime(userId))
      }
      pendingStart = undefined
      elapsed = 0
      void flushLearningTime(userId)
    }
    const tick = () => {
      const now = performance.now()
      const wall = Date.now()
      const delta = now - lastTick
      const activeEnd = Math.min(now, lastActivity + idleMs)
      const duration = Math.max(0, activeEnd - lastTick)
      // Skip long scheduling gaps (sleep / suspended browser) and clock changes.
      if (foreground && delta <= 5000 && Math.abs(wall - lastWall - delta) < 2000 && duration > 0) {
        pendingStart ??= wall - delta
        pendingEnd = wall - delta + duration
        elapsed += duration
      } else if (pendingStart !== undefined) persist()
      setPaused(foreground && now >= lastActivity + idleMs)
      lastTick = now
      lastWall = wall
      if (elapsed >= 20_000) persist()
    }
    const interact = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== 'visible' || !document.hasFocus()) return
      tick()
      lastActivity = performance.now()
      setPaused(false)
    }
    const changeForeground = () => {
      tick()
      persist()
      foreground = document.visibilityState === 'visible' && document.hasFocus()
      if (foreground) { lastActivity = performance.now(); setPaused(false) }
    }
    const online = () => { void flushLearningTime(userId) }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach(event => window.addEventListener(event, interact, { passive: true }))
    document.addEventListener('visibilitychange', changeForeground)
    window.addEventListener('focus', changeForeground)
    window.addEventListener('blur', changeForeground)
    window.addEventListener('pagehide', changeForeground)
    window.addEventListener('online', online)
    const interval = window.setInterval(tick, 1000)
    online()
    return () => {
      tick(); persist()
      window.clearInterval(interval)
      events.forEach(event => window.removeEventListener(event, interact))
      document.removeEventListener('visibilitychange', changeForeground)
      window.removeEventListener('focus', changeForeground)
      window.removeEventListener('blur', changeForeground)
      window.removeEventListener('pagehide', changeForeground)
      window.removeEventListener('online', online)
    }
  }, [activity, enabled, userId])
  return enabled && paused ? <p className="learning-timer-status" role="status">잠시 학습 시간 측정을 멈췄어요. 화면을 터치하거나 스크롤하면 다시 시작해요.</p> : null
}
