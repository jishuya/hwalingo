import { analyticsRange } from '../domain/learning/analyticsRange.js'
import { Router } from 'express'
import { pool } from '../config/database.js'
import { calculateLevelProgress } from '../domain/learning/level.js'
import { hwarangGradeForLevel } from '../domain/learning/hwarangGrade.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { calculateStreakSummary } from '../domain/learning/streak.js'

export const progressRouter = Router()

progressRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query<{
      total_xp: string
      prestige_level: number
      saved_words: string
      mastered_words: string
      due_words: string
    }>(
      `SELECT COALESCE(up.total_xp, 0) AS total_xp,
              COALESCE(up.prestige_level, 0) AS prestige_level,
              count(v.id) FILTER (WHERE v.archived_at IS NULL) AS saved_words,
              count(v.id) FILTER (WHERE v.archived_at IS NULL AND vp.mastery_level >= 6) AS mastered_words,
              count(v.id) FILTER (WHERE v.archived_at IS NULL AND vp.total_attempts > 0 AND vp.next_review_at <= CURRENT_TIMESTAMP) AS due_words
       FROM users u
       LEFT JOIN user_progress up ON up.user_id = u.id
       LEFT JOIN vocabularies v ON v.user_id = u.id
       LEFT JOIN vocabulary_progress vp ON vp.user_id = v.user_id AND vp.vocabulary_id = v.id
       WHERE u.id = $1
       GROUP BY up.total_xp, up.prestige_level`,
      [request.auth!.userId],
    )
    const row = result.rows[0]
    const totalXp = Number(row?.total_xp ?? 0)
    const level = calculateLevelProgress(totalXp)
    const settingsResult = await pool.query<{ weekly_goal_days: number; today: string }>(
      `SELECT COALESCE(us.weekly_goal_days, 5) AS weekly_goal_days,
              to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS today
       FROM users u LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = $1`,
      [request.auth!.userId],
    )
    const settings = settingsResult.rows[0]
    const learningDaysResult = await pool.query<{ learning_date: string }>(
      `SELECT learning_date::text FROM user_learning_days WHERE user_id = $1 ORDER BY learning_date DESC`,
      [request.auth!.userId],
    )
    const streak = calculateStreakSummary(learningDaysResult.rows.map(item => item.learning_date), settings.today)
    const [masteryResult, quizResult, recentResult, weeklyTrendResult] = await Promise.all([
      pool.query<{ mastery_level: number; word_count: string }>(
        `SELECT COALESCE(vp.mastery_level, 0) AS mastery_level, count(*) AS word_count
         FROM vocabularies v
         LEFT JOIN vocabulary_progress vp ON vp.user_id = v.user_id AND vp.vocabulary_id = v.id
         WHERE v.user_id = $1 AND v.archived_at IS NULL
         GROUP BY COALESCE(vp.mastery_level, 0) ORDER BY mastery_level`,
        [request.auth!.userId],
      ),
      pool.query<{ total_answers: string; correct_answers: string }>(
        `SELECT count(*) FILTER (WHERE result IN ('correct', 'incorrect')) AS total_answers,
                count(*) FILTER (WHERE result = 'correct') AS correct_answers
         FROM quizzes WHERE user_id = $1`,
        [request.auth!.userId],
      ),
      pool.query<{ learning_date: string; activity_count: number; earned_xp: number; reviewed_word_count: number }>(
        `SELECT to_char(days.day, 'YYYY-MM-DD') AS learning_date,
                COALESCE(uld.activity_count, 0)::integer AS activity_count,
                COALESCE(uld.earned_xp, 0)::integer AS earned_xp,
                COALESCE(uld.reviewed_word_count, 0)::integer AS reviewed_word_count
         FROM generate_series($2::date - 6, $2::date, interval '1 day') AS days(day)
         LEFT JOIN user_learning_days uld ON uld.user_id = $1 AND uld.learning_date = days.day::date
         ORDER BY days.day`,
        [request.auth!.userId, settings.today],
      ),
      pool.query<{ week_start: string; active_days: number; earned_xp: number; reviewed_word_count: number; total_answers: number; correct_answers: number }>(
        `WITH weeks AS (
           SELECT generate_series(
             date_trunc('week', $2::date) - interval '7 weeks',
             date_trunc('week', $2::date),
             interval '1 week'
           )::date AS week_start
         )
         SELECT to_char(w.week_start, 'YYYY-MM-DD') AS week_start,
                (SELECT count(*) FROM user_learning_days uld
                 WHERE uld.user_id = $1 AND uld.learning_date >= w.week_start AND uld.learning_date < w.week_start + 7)::integer AS active_days,
                COALESCE((SELECT sum(uld.earned_xp) FROM user_learning_days uld
                 WHERE uld.user_id = $1 AND uld.learning_date >= w.week_start AND uld.learning_date < w.week_start + 7), 0)::integer AS earned_xp,
                COALESCE((SELECT sum(uld.reviewed_word_count) FROM user_learning_days uld
                 WHERE uld.user_id = $1 AND uld.learning_date >= w.week_start AND uld.learning_date < w.week_start + 7), 0)::integer AS reviewed_word_count,
                (SELECT count(*) FROM quizzes q WHERE q.user_id = $1 AND q.result IN ('correct', 'incorrect')
                 AND (q.answered_at AT TIME ZONE 'Asia/Seoul')::date >= w.week_start
                 AND (q.answered_at AT TIME ZONE 'Asia/Seoul')::date < w.week_start + 7)::integer AS total_answers,
                (SELECT count(*) FROM quizzes q WHERE q.user_id = $1 AND q.result = 'correct'
                 AND (q.answered_at AT TIME ZONE 'Asia/Seoul')::date >= w.week_start
                 AND (q.answered_at AT TIME ZONE 'Asia/Seoul')::date < w.week_start + 7)::integer AS correct_answers
         FROM weeks w ORDER BY w.week_start`,
        [request.auth!.userId, settings.today],
      ),
    ])
    const masteryDistribution = Array.from({ length: 8 }, (_, masteryLevel) => ({ masteryLevel, wordCount: 0 }))
    for (const item of masteryResult.rows) masteryDistribution[item.mastery_level].wordCount = Number(item.word_count)
    const totalAnswers = Number(quizResult.rows[0]?.total_answers ?? 0)
    const correctAnswers = Number(quizResult.rows[0]?.correct_answers ?? 0)
    response.json({
      progress: {
        totalXp,
        ...level,
        hwarangGrade: hwarangGradeForLevel(level.level),
        prestigeLevel: row?.prestige_level ?? 0,
        savedWords: Number(row?.saved_words ?? 0),
        masteredWords: Number(row?.mastered_words ?? 0),
        dueWords: Number(row?.due_words ?? 0),
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        weeklyCompletedDays: streak.weeklyCompletedDays,
        weeklyGoalDays: settings.weekly_goal_days,
        masteryDistribution,
        totalAnswers,
        correctAnswers,
        accuracyPercent: totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        recentLearningDays: recentResult.rows.map(item => ({ date: item.learning_date, activityCount: item.activity_count, earnedXp: item.earned_xp, reviewedWordCount: item.reviewed_word_count })),
        weeklyLearningTrend: weeklyTrendResult.rows.map(item => ({
          weekStart: item.week_start,
          activeDays: item.active_days,
          earnedXp: item.earned_xp,
          reviewedWordCount: item.reviewed_word_count,
          totalAnswers: item.total_answers,
          accuracyPercent: item.total_answers ? Math.round((item.correct_answers / item.total_answers) * 100) : null,
        })),
      },
    })
  } catch (error) {
    next(error)
  }
})

progressRouter.get('/activity', requireAuth, async (request, response, next) => {
  try {
    const range = await analyticsRange(pool, request.auth!.userId, request.query)
    // Rank the entire retained history before filtering the date range. Mastery 0
    // and a session's selection group do not reliably mean a first-ever answer.
    const result = await pool.query<{
      date: string; new_answers: number; review_answers: number; unique_words: number;
      correct_answers: number; period_unique_words: number
    }>(`
      WITH history AS (
        SELECT q.vocabulary_id, q.result, q.answered_at,
          row_number() OVER (PARTITION BY q.vocabulary_id ORDER BY q.answered_at, q.id) AS attempt
        FROM quizzes q
        LEFT JOIN quiz_session_items item ON item.id = q.quiz_session_item_id
        WHERE q.user_id = $1 AND q.result IN ('correct', 'incorrect')
          AND item.retry_of_item_id IS NULL
      ), period AS (
        SELECT h.*, date_trunc($4, h.answered_at AT TIME ZONE 'Asia/Seoul')::date AS day
        FROM history h
        WHERE h.answered_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'
          AND h.answered_at < ($3::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul'
      ), days AS (
        SELECT generate_series(date_trunc($4, $2::date), date_trunc($4, $3::date),
          ('1 ' || $4)::interval)::date AS day
      )
      SELECT d.day::text AS date,
        count(p.vocabulary_id) FILTER (WHERE p.attempt = 1)::integer AS new_answers,
        count(p.vocabulary_id) FILTER (WHERE p.attempt > 1)::integer AS review_answers,
        count(DISTINCT p.vocabulary_id)::integer AS unique_words,
        count(p.vocabulary_id) FILTER (WHERE p.result = 'correct')::integer AS correct_answers,
        (SELECT count(DISTINCT vocabulary_id)::integer FROM period) AS period_unique_words
      FROM days d LEFT JOIN period p ON p.day = d.day
      GROUP BY d.day ORDER BY d.day`, [request.auth!.userId, range.start, range.end, range.grain])
    response.json({ range,
      uniqueWords: result.rows[0]?.period_unique_words ?? 0,
      days: result.rows.map(row => ({
        date: row.date, newAnswers: row.new_answers, reviewAnswers: row.review_answers,
        uniqueWords: row.unique_words, correctAnswers: row.correct_answers,
      })),
    })
  } catch (error) { next(error) }
})

progressRouter.get('/calendar', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query<{
      date: string; activity_count: number; earned_xp: number; answer_count: number
    }>(`
      WITH bounds AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS today
      ), days AS (
        SELECT generate_series(today - 364, today, interval '1 day')::date AS day FROM bounds
      )
      SELECT d.day::text AS date,
        COALESCE(uld.activity_count, 0)::integer AS activity_count,
        COALESCE(uld.earned_xp, 0)::integer AS earned_xp,
        COALESCE(uld.reviewed_word_count, 0)::integer AS answer_count
      FROM days d LEFT JOIN user_learning_days uld ON uld.user_id = $1 AND uld.learning_date = d.day
      ORDER BY d.day`, [request.auth!.userId])
    response.json({ days: result.rows.map(day => ({
      date: day.date, activityCount: day.activity_count, earnedXp: day.earned_xp, answerCount: day.answer_count,
    })) })
  } catch (error) { next(error) }
})

progressRouter.get('/relearning', requireAuth, async (request, response, next) => {
  try {
    const range = await analyticsRange(pool,request.auth!.userId,request.query)
    const result = await pool.query<{
      date: string; completed: number; remaining: number; unavailable: number;
      standard_remaining: number; incorrect_remaining: number
    }>(`
      WITH mistakes AS (
        SELECT date_trunc($4,q.answered_at AT TIME ZONE 'Asia/Seoul')::date AS day, s.mode,
          CASE WHEN EXISTS (
            SELECT 1 FROM quiz_session_items retry
            WHERE retry.retry_of_item_id = original.id AND retry.session_id = original.session_id
              AND retry.result = 'correct'
          ) THEN 'completed'
          WHEN s.status = 'active' AND v.archived_at IS NULL AND EXISTS (
            SELECT 1 FROM quiz_session_items retry
            WHERE retry.retry_of_item_id = original.id AND retry.session_id = original.session_id
              AND retry.result IS NULL
          ) THEN 'remaining'
          ELSE 'unavailable' END AS state
        FROM quizzes q
        LEFT JOIN quiz_session_items original ON original.id = q.quiz_session_item_id
        LEFT JOIN quiz_sessions s ON s.id = original.session_id AND s.user_id = q.user_id
        LEFT JOIN vocabularies v ON v.id = q.vocabulary_id AND v.user_id = q.user_id
        WHERE q.user_id = $1 AND q.result = 'incorrect' AND original.retry_of_item_id IS NULL
          AND q.answered_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'
          AND q.answered_at < ($3::date+1)::timestamp AT TIME ZONE 'Asia/Seoul'
      ), days AS (
        SELECT generate_series(date_trunc($4,$2::date),date_trunc($4,$3::date),('1 '||$4)::interval)::date AS day
      )
      SELECT d.day::text AS date,
        count(*) FILTER(WHERE m.state = 'completed')::integer AS completed,
        count(*) FILTER(WHERE m.state = 'remaining')::integer AS remaining,
        count(*) FILTER(WHERE m.state = 'unavailable')::integer AS unavailable,
        count(*) FILTER(WHERE m.state = 'remaining' AND m.mode = 'standard')::integer AS standard_remaining,
        count(*) FILTER(WHERE m.state = 'remaining' AND m.mode = 'incorrect')::integer AS incorrect_remaining
      FROM days d LEFT JOIN mistakes m ON m.day = d.day GROUP BY d.day ORDER BY d.day`, [request.auth!.userId,range.start,range.end,range.grain])
    response.json({ range,days: result.rows.map(row => ({
      date: row.date, completed: row.completed, remaining: row.remaining, unavailable: row.unavailable,
      standardRemaining: row.standard_remaining, incorrectRemaining: row.incorrect_remaining,
    })) })
  } catch (error) { next(error) }
})

progressRouter.get('/insights', requireAuth, async (request, response, next) => {
  try {
    const userId = request.auth!.userId
    const range = await analyticsRange(pool, userId, request.query)
    const params = [userId,range.start,range.end,range.grain]
    const [activities, languages, growth, weekdays] = await Promise.all([
      pool.query<{ type: string; count: number }>(`
        SELECT activity_type AS type,count(*)::integer AS count FROM learning_activities
        WHERE user_id=$1 AND activity_type <> 'story'
          AND activity_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'
          AND activity_at < ($3::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY activity_type
        UNION ALL SELECT 'story',count(*)::integer FROM ai_stories WHERE user_id=$1
          AND created_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'
          AND created_at < ($3::date+1)::timestamp AT TIME ZONE 'Asia/Seoul'`, params.slice(0,3)),
      pool.query<{ language: string; saved: number; learned: number; mastered: number; answers: number }>(`
        WITH answers AS (
          SELECT v.language_code,count(*)::integer AS count FROM quizzes q
          JOIN vocabularies v ON v.id=q.vocabulary_id
          LEFT JOIN quiz_session_items i ON i.id=q.quiz_session_item_id
          WHERE q.user_id=$1 AND q.result IN ('correct','incorrect') AND i.retry_of_item_id IS NULL
            AND q.answered_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'
            AND q.answered_at < ($3::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY v.language_code
        )
        SELECT v.language_code AS language,
          count(*) FILTER(WHERE v.archived_at IS NULL)::integer AS saved,
          count(*) FILTER(WHERE v.archived_at IS NULL AND p.total_attempts>0)::integer AS learned,
          count(*) FILTER(WHERE v.archived_at IS NULL AND p.mastery_level>=6)::integer AS mastered,
          COALESCE(a.count,0)::integer AS answers
        FROM vocabularies v LEFT JOIN vocabulary_progress p ON p.vocabulary_id=v.id AND p.user_id=v.user_id
        LEFT JOIN answers a ON a.language_code=v.language_code
        WHERE v.user_id=$1 GROUP BY v.language_code,a.count
        HAVING count(*) FILTER(WHERE v.archived_at IS NULL)>0 OR COALESCE(a.count,0)>0
        ORDER BY saved DESC,v.language_code`, params.slice(0,3)),
      pool.query<{ date: string; xp: number; opening: number }>(`
        WITH opening AS (
          SELECT COALESCE((SELECT total_xp FROM user_progress WHERE user_id=$1),0)
            - COALESCE((SELECT sum(amount) FROM xp_events WHERE user_id=$1
                AND created_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'),0) AS value
        ), buckets AS (
          SELECT generate_series(date_trunc($4,$2::date),date_trunc($4,$3::date),('1 '||$4)::interval)::date AS day
        ), earned AS (
          SELECT date_trunc($4,created_at AT TIME ZONE 'Asia/Seoul')::date AS day,sum(amount) AS xp
          FROM xp_events WHERE user_id=$1
            AND created_at >= $2::date::timestamp AT TIME ZONE 'Asia/Seoul'
            AND created_at < ($3::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' GROUP BY 1
        )
        SELECT b.day::text AS date, COALESCE(e.xp,0)::float8 AS xp,o.value::float8 AS opening
        FROM buckets b LEFT JOIN earned e ON e.day=b.day CROSS JOIN opening o ORDER BY b.day`, params),
      pool.query<{ weekday: number; answers: number; active_days: number; seconds: number; measured_days: number }>(`
        WITH dates AS (
          SELECT generate_series($2::date-55,$2::date,interval '1 day')::date AS day
        ), daily AS (
          SELECT day,COALESCE(d.reviewed_word_count,0) AS answers,COALESCE(d.activity_count,0) AS activities,
            day >= (s.measurement_started_at AT TIME ZONE 'Asia/Seoul')::date AS measured,
            COALESCE((SELECT sum(EXTRACT(EPOCH FROM upper(r)-lower(r))) FROM unnest((
              SELECT range_agg(tstzrange(GREATEST(e.started_at,day::timestamp AT TIME ZONE 'Asia/Seoul'),
                LEAST(e.ended_at,(day+1)::timestamp AT TIME ZONE 'Asia/Seoul'),'[)'))
              FROM learning_time_events e WHERE e.user_id=$1
                AND e.started_at < (day+1)::timestamp AT TIME ZONE 'Asia/Seoul'
                AND e.ended_at > day::timestamp AT TIME ZONE 'Asia/Seoul')) AS r),0) AS seconds
          FROM dates LEFT JOIN user_learning_days d ON d.user_id=$1 AND d.learning_date=day
          LEFT JOIN learning_time_settings s ON s.user_id=$1
        ) SELECT extract(isodow FROM day)::integer AS weekday,sum(answers)::integer AS answers,
          count(*) FILTER(WHERE activities>0)::integer AS active_days,
          sum(seconds)::float8 AS seconds,count(*) FILTER(WHERE measured)::integer AS measured_days
        FROM daily GROUP BY 1 ORDER BY 1`, [userId,range.today]),
    ])
    let cumulative = Math.max(0,growth.rows[0]?.opening ?? 0)
    const growthDays = growth.rows.map(day => {
      const before = calculateLevelProgress(cumulative).level
      cumulative += day.xp
      const after = calculateLevelProgress(cumulative).level
      return { date: day.date, earnedXp: day.xp, totalXp: cumulative, level: after, levelsGained: after-before,
        grade: hwarangGradeForLevel(after).name }
    })
    response.json({ range,activities: activities.rows,languages: languages.rows,
      growth: { openingXp: Math.max(0,growth.rows[0]?.opening ?? 0),days: growthDays },
      weekdays: weekdays.rows.map(day => ({ weekday: day.weekday,averageAnswers: day.answers/8,
        averageSeconds: day.measured_days ? day.seconds/day.measured_days : null,
        activeDays: day.active_days,observedDays: 8,measuredDays: day.measured_days })) })
  } catch (error) { next(error) }
})
