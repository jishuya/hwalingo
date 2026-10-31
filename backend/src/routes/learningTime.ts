import { analyticsRange } from '../domain/learning/analyticsRange.js'
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
    await pool.query(`INSERT INTO learning_time_settings(user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [request.auth!.userId])
    const range = await analyticsRange(pool, request.auth!.userId, request.query)
    const settings = await pool.query<{ measurement_started_at: Date }>(`SELECT measurement_started_at FROM learning_time_settings WHERE user_id = $1`, [request.auth!.userId])
    const result = await pool.query<{ date: string; end_date: string; seconds: number; measured_days: number; active_days: number; analysis: number; vocabulary: number; quiz: number; story: number }>(`
      WITH days AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
      ), raw AS (
        SELECT day,e.activity_type,
          CASE e.activity_type WHEN 'quiz' THEN 1 WHEN 'analysis' THEN 2 WHEN 'vocabulary' THEN 3 ELSE 4 END AS priority,
          range_agg(tstzrange(GREATEST(e.started_at,day::timestamp AT TIME ZONE 'Asia/Seoul'),
            LEAST(e.ended_at,(day+1)::timestamp AT TIME ZONE 'Asia/Seoul'),'[)')) AS spans
        FROM days JOIN learning_time_events e ON e.user_id=$1
          AND e.started_at < (day+1)::timestamp AT TIME ZONE 'Asia/Seoul'
          AND e.ended_at > day::timestamp AT TIME ZONE 'Asia/Seoul'
        GROUP BY day,e.activity_type
      ), claimed AS (
        SELECT current.day,current.activity_type,current.spans - COALESCE((
          SELECT range_agg(r) FROM raw previous CROSS JOIN LATERAL unnest(previous.spans) AS r
          WHERE previous.day=current.day AND previous.priority<current.priority
        ),'{}'::tstzmultirange) AS spans FROM raw current
      ), portions AS (
        SELECT day,activity_type,sum(EXTRACT(EPOCH FROM upper(r)-lower(r)))::float8 AS seconds
        FROM claimed CROSS JOIN LATERAL unnest(spans) AS r GROUP BY day,activity_type
      ), daily AS (
        SELECT days.day,COALESCE(sum(p.seconds),0)::float8 AS seconds,
          COALESCE(sum(p.seconds) FILTER(WHERE activity_type='analysis'),0)::float8 AS analysis,
          COALESCE(sum(p.seconds) FILTER(WHERE activity_type='vocabulary'),0)::float8 AS vocabulary,
          COALESCE(sum(p.seconds) FILTER(WHERE activity_type='quiz'),0)::float8 AS quiz,
          COALESCE(sum(p.seconds) FILTER(WHERE activity_type='story'),0)::float8 AS story
        FROM days LEFT JOIN portions p ON p.day=days.day GROUP BY days.day
      )
      SELECT date_trunc($4, day)::date::text AS date, max(day)::text AS end_date,
        sum(seconds)::float8 AS seconds,
        sum(analysis)::float8 AS analysis,sum(vocabulary)::float8 AS vocabulary,
        sum(quiz)::float8 AS quiz,sum(story)::float8 AS story,
        count(*) FILTER(WHERE day >= ($5::timestamptz AT TIME ZONE 'Asia/Seoul')::date)::integer AS measured_days,
        count(*) FILTER(WHERE seconds > 0)::integer AS active_days
      FROM daily GROUP BY date_trunc($4,day) ORDER BY date`,
      [request.auth!.userId,range.start,range.end,range.grain,settings.rows[0].measurement_started_at])
    response.json({ range, measurementStartedAt: settings.rows[0].measurement_started_at,
      days: result.rows.map(day => ({ date: day.date, endDate: day.end_date, seconds: day.seconds, measuredDays: day.measured_days, activeDays: day.active_days, byActivity: { analysis: day.analysis, vocabulary: day.vocabulary, quiz: day.quiz, story: day.story } })) })
  } catch (error) { next(error) }
})
