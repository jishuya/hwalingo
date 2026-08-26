import { Router } from 'express'
import { pool } from '../config/database.js'
import { calculateLevelProgress } from '../domain/learning/level.js'
import { rankForLevel } from '../domain/learning/rank.js'
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
              count(f.id) AS saved_words,
              count(f.id) FILTER (WHERE vp.mastery_level >= 6) AS mastered_words,
              count(f.id) FILTER (WHERE vp.total_attempts > 0 AND vp.next_review_at <= CURRENT_TIMESTAMP) AS due_words
       FROM users u
       LEFT JOIN user_progress up ON up.user_id = u.id
       LEFT JOIN favorite_vocabularies f ON f.user_id = u.id
       LEFT JOIN vocabulary_progress vp ON vp.user_id = f.user_id AND vp.vocabulary_id = f.vocabulary_id
       WHERE u.id = $1
       GROUP BY up.total_xp, up.prestige_level`,
      [request.auth!.userId],
    )
    const row = result.rows[0]
    const totalXp = Number(row?.total_xp ?? 0)
    const level = calculateLevelProgress(totalXp)
    const settingsResult = await pool.query<{ timezone: string; weekly_goal_days: number; today: string }>(
      `SELECT COALESCE(us.timezone, 'Asia/Seoul') AS timezone,
              COALESCE(us.weekly_goal_days, 5) AS weekly_goal_days,
              to_char(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(us.timezone, 'Asia/Seoul'), 'YYYY-MM-DD') AS today
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
    response.json({
      progress: {
        totalXp,
        ...level,
        rank: rankForLevel(level.level),
        prestigeLevel: row?.prestige_level ?? 0,
        savedWords: Number(row?.saved_words ?? 0),
        masteredWords: Number(row?.mastered_words ?? 0),
        dueWords: Number(row?.due_words ?? 0),
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        weeklyCompletedDays: streak.weeklyCompletedDays,
        weeklyGoalDays: settings.weekly_goal_days,
        timezone: settings.timezone,
      },
    })
  } catch (error) {
    next(error)
  }
})
