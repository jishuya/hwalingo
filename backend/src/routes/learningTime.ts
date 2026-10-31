import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'

export const learningTimeRouter = Router()
learningTimeRouter.use(requireAuth)

learningTimeRouter.post('/events', async (request, response, next) => {
  if (request.body.userId !== request.auth!.userId) {
    response.status(403).json({ message: '학습 시간의 사용자가 일치하지 않습니다.' })
    return
  }
  const events: unknown = request.body.events
  if (!Array.isArray(events) || events.length > 100 || events.some(event => {
    if (!event || typeof event !== 'object') return true
    const start = Date.parse(event.startedAt)
    const end = Date.parse(event.endedAt)
    return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id)
      || !['analysis', 'vocabulary', 'quiz', 'story'].includes(event.activity)
      || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 30_000
      || end > Date.now() + 60_000 || start < Date.now() - 30 * 86400_000
  })) {
    response.status(400).json({ message: '학습 시간 기록이 올바르지 않습니다.' })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`INSERT INTO learning_time_settings(user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [request.auth!.userId])
    for (const event of events) {
      await client.query(`UPDATE learning_time_settings SET measurement_started_at = LEAST(measurement_started_at, $2::timestamptz) WHERE user_id = $1`, [request.auth!.userId, event.startedAt])
      await client.query(`INSERT INTO learning_time_events(user_id,event_id,activity_type,started_at,ended_at)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [request.auth!.userId, event.id, event.activity, event.startedAt, event.endedAt])
    }
    await client.query('COMMIT')
    response.sendStatus(204)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally { client.release() }
})

learningTimeRouter.get('/me', async (request, response, next) => {
  try {
    // Also marks the start for users who have no measured activity yet.
    await pool.query(`INSERT INTO learning_time_settings(user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [request.auth!.userId])
    const result = await pool.query<{ date: string; seconds: number }>(`
      WITH bounds AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today
      ), days AS (
        SELECT generate_series(today - 6, today, interval '1 day')::date AS day FROM bounds
      )
      SELECT days.day::text AS date,
        COALESCE((SELECT sum(EXTRACT(EPOCH FROM upper(r) - lower(r)))
          FROM unnest((SELECT range_agg(tstzrange(
            GREATEST(e.started_at, days.day::timestamp AT TIME ZONE 'Asia/Seoul'),
            LEAST(e.ended_at, (days.day + 1)::timestamp AT TIME ZONE 'Asia/Seoul'), '[)'))
          FROM learning_time_events e WHERE e.user_id = $1
            AND e.started_at < (days.day + 1)::timestamp AT TIME ZONE 'Asia/Seoul'
            AND e.ended_at > days.day::timestamp AT TIME ZONE 'Asia/Seoul')) AS r), 0)::float8 AS seconds
      FROM days ORDER BY day`, [request.auth!.userId])
    const settings = await pool.query<{ measurement_started_at: Date }>(`SELECT measurement_started_at FROM learning_time_settings WHERE user_id = $1`, [request.auth!.userId])
    response.json({ measurementStartedAt: settings.rows[0].measurement_started_at, days: result.rows })
  } catch (error) { next(error) }
})
