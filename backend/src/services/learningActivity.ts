import type { PoolClient } from 'pg'

export type LearningActivityType = 'analysis' | 'vocabulary' | 'quiz' | 'story'

export async function recordLearningActivity(
  client: PoolClient,
  userId: string,
  activityType: LearningActivityType,
  options: { durationSeconds?: number; earnedXp?: number; reviewedWordCount?: number; occurredAt?: Date } = {},
): Promise<void> {
  const durationSeconds = Math.max(0, Math.round(options.durationSeconds ?? 0))
  const earnedXp = Math.max(0, Math.round(options.earnedXp ?? 0))
  const reviewedWordCount = Math.max(0, Math.round(options.reviewedWordCount ?? 0))
  const occurredAt = options.occurredAt ?? new Date()

  await client.query(
    `INSERT INTO learning_activities (user_id, activity_type, duration_seconds, activity_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, activityType, durationSeconds, occurredAt],
  )
  await client.query(
    `INSERT INTO user_learning_days
       (user_id, learning_date, activity_count, earned_xp, reviewed_word_count)
     VALUES (
       $1,
       ($2::timestamptz AT TIME ZONE COALESCE((SELECT timezone FROM user_settings WHERE user_id = $1), 'Asia/Seoul'))::date,
       1, $3, $4
     )
     ON CONFLICT (user_id, learning_date) DO UPDATE SET
       activity_count = user_learning_days.activity_count + 1,
       earned_xp = user_learning_days.earned_xp + EXCLUDED.earned_xp,
       reviewed_word_count = user_learning_days.reviewed_word_count + EXCLUDED.reviewed_word_count,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, occurredAt, earnedXp, reviewedWordCount],
  )
}
