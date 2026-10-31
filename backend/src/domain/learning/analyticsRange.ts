import type { Pool } from 'pg'

export async function analyticsRange(db: Pool, userId: string, query: Record<string, unknown>) {
  const result = await db.query<{ today: string; first: string }>(`
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date::text AS today,
      LEAST((u.created_at AT TIME ZONE 'Asia/Seoul')::date,
        (SELECT min(learning_date) FROM user_learning_days WHERE user_id=u.id),
        (SELECT min((answered_at AT TIME ZONE 'Asia/Seoul')::date) FROM quizzes WHERE user_id=u.id),
        (SELECT min((started_at AT TIME ZONE 'Asia/Seoul')::date) FROM learning_time_events WHERE user_id=u.id),
        (SELECT min((created_at AT TIME ZONE 'Asia/Seoul')::date) FROM xp_events WHERE user_id=u.id),
        (SELECT min((created_at AT TIME ZONE 'Asia/Seoul')::date) FROM ai_stories WHERE user_id=u.id))::text AS first
    FROM users u WHERE u.id=$1`, [userId])
  const today = result.rows[0].today
  const valid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
  if ((query.from !== undefined && !valid(query.from)) || (query.to !== undefined && !valid(query.to))) throw new Error('INVALID_ANALYTICS_RANGE')
  const end = typeof query.to === 'string' && query.to < today ? query.to : today
  const defaultStart = new Date(`${end}T00:00:00Z`)
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6)
  const start = query.period === 'all' ? result.rows[0].first : typeof query.from === 'string' ? query.from : defaultStart.toISOString().slice(0,10)
  if (start > end || start < '1970-01-01') throw new Error('INVALID_ANALYTICS_RANGE')
  const span = (Date.parse(end) - Date.parse(start)) / 86400000 + 1
  return { start, end, today, grain: span > 730 ? 'year' : span > 62 ? 'month' : 'day' }
}
