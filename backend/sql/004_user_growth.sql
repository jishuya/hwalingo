BEGIN;

CREATE TABLE IF NOT EXISTS user_progress (
    user_id             BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    total_xp            BIGINT NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
    prestige_level      INTEGER NOT NULL DEFAULT 0 CHECK (prestige_level >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_progress (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0);

ALTER TABLE quiz_sessions
    ADD COLUMN IF NOT EXISTS earned_xp INTEGER NOT NULL DEFAULT 0 CHECK (earned_xp >= 0);

CREATE TABLE IF NOT EXISTS xp_events (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    quiz_id             BIGINT REFERENCES quizzes (id) ON DELETE SET NULL,
    event_type          VARCHAR(30) NOT NULL,
    amount              INTEGER NOT NULL CHECK (amount >= 0),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT xp_events_type_check
        CHECK (event_type IN ('quiz_review', 'bonus', 'adjustment'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_events_quiz_unique
    ON xp_events (quiz_id)
    WHERE quiz_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
    ON xp_events (user_id, created_at DESC);

COMMIT;
