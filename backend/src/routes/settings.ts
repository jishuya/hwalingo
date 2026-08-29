import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'

type Theme = 'light' | 'dark' | 'system'

interface SettingsRow {
  theme: Theme
  notifications_enabled: boolean
  timezone: string
  weekly_goal_days: number
  quiz_question_count: number
}

const themes = new Set<Theme>(['light', 'dark', 'system'])
const supportedTimezones = new Set(['Asia/Seoul', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'])
const quizQuestionCounts = new Set([5, 10, 20, 30])

export const settingsRouter = Router()

settingsRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query<SettingsRow>(
      `INSERT INTO user_settings (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING theme, notifications_enabled, timezone, weekly_goal_days, quiz_question_count`,
      [request.auth!.userId],
    )
    const row = result.rows[0]
    response.json({ settings: { theme: row.theme, notificationsEnabled: row.notifications_enabled, timezone: row.timezone, weeklyGoalDays: row.weekly_goal_days, quizQuestionCount: row.quiz_question_count } })
  } catch (error) {
    next(error)
  }
})

settingsRouter.patch('/me', requireAuth, async (request, response, next) => {
  try {
    const theme = request.body.theme as Theme
    const notificationsEnabled = request.body.notificationsEnabled
    const timezone = request.body.timezone
    const weeklyGoalDays = request.body.weeklyGoalDays
    const quizQuestionCount = request.body.quizQuestionCount
    if (!themes.has(theme) || typeof notificationsEnabled !== 'boolean' || !supportedTimezones.has(timezone) || !Number.isInteger(weeklyGoalDays) || weeklyGoalDays < 1 || weeklyGoalDays > 7 || !quizQuestionCounts.has(quizQuestionCount)) {
      response.status(400).json({ status: 'error', message: '설정값을 확인해주세요.' })
      return
    }
    const result = await pool.query<SettingsRow>(
      `INSERT INTO user_settings (user_id, theme, notifications_enabled, timezone, weekly_goal_days, quiz_question_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme,
         notifications_enabled = EXCLUDED.notifications_enabled, timezone = EXCLUDED.timezone,
         weekly_goal_days = EXCLUDED.weekly_goal_days, quiz_question_count = EXCLUDED.quiz_question_count,
         updated_at = CURRENT_TIMESTAMP
       RETURNING theme, notifications_enabled, timezone, weekly_goal_days, quiz_question_count`,
      [request.auth!.userId, theme, notificationsEnabled, timezone, weeklyGoalDays, quizQuestionCount],
    )
    const row = result.rows[0]
    response.json({ settings: { theme: row.theme, notificationsEnabled: row.notifications_enabled, timezone: row.timezone, weeklyGoalDays: row.weekly_goal_days, quizQuestionCount: row.quiz_question_count } })
  } catch (error) {
    next(error)
  }
})
