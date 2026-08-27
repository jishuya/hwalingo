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
    const [masteryResult, quizResult, recentResult] = await Promise.all([
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
    ])
    const masteryDistribution = Array.from({ length: 8 }, (_, masteryLevel) => ({ masteryLevel, wordCount: 0 }))
    for (const item of masteryResult.rows) masteryDistribution[item.mastery_level].wordCount = Number(item.word_count)
    const totalAnswers = Number(quizResult.rows[0]?.total_answers ?? 0)
    const correctAnswers = Number(quizResult.rows[0]?.correct_answers ?? 0)
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
        masteryDistribution,
        totalAnswers,
        correctAnswers,
        accuracyPercent: totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        recentLearningDays: recentResult.rows.map(item => ({ date: item.learning_date, activityCount: item.activity_count, earnedXp: item.earned_xp, reviewedWordCount: item.reviewed_word_count })),
      },
    })
  } catch (error) {
    next(error)
  }
})
