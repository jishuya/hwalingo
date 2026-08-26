BEGIN;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    ADD COLUMN IF NOT EXISTS weekly_goal_days SMALLINT NOT NULL DEFAULT 5;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_weekly_goal_check'
    ) THEN
        ALTER TABLE user_settings
            ADD CONSTRAINT user_settings_weekly_goal_check
            CHECK (weekly_goal_days BETWEEN 1 AND 7);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_learning_days (
    user_id             BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    learning_date       DATE NOT NULL,
    activity_count      INTEGER NOT NULL DEFAULT 0 CHECK (activity_count >= 0),
    earned_xp           INTEGER NOT NULL DEFAULT 0 CHECK (earned_xp >= 0),
    reviewed_word_count INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_word_count >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, learning_date)
);

CREATE INDEX IF NOT EXISTS idx_user_learning_days_user_date
    ON user_learning_days (user_id, learning_date DESC);

-- 기존 활동 기록은 사용자 설정 시간대 기준의 일별 데이터로 백필한다.
INSERT INTO user_learning_days (user_id, learning_date, activity_count)
SELECT la.user_id,
       (la.activity_at AT TIME ZONE COALESCE(us.timezone, 'Asia/Seoul'))::date,
       count(*)::integer
FROM learning_activities la
LEFT JOIN user_settings us ON us.user_id = la.user_id
GROUP BY la.user_id, (la.activity_at AT TIME ZONE COALESCE(us.timezone, 'Asia/Seoul'))::date
ON CONFLICT (user_id, learning_date) DO NOTHING;

COMMIT;
