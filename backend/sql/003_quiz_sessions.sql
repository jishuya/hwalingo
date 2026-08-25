BEGIN;

CREATE TABLE IF NOT EXISTS quiz_sessions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status              VARCHAR(15) NOT NULL DEFAULT 'active',
    requested_count     SMALLINT NOT NULL,
    total_count         SMALLINT NOT NULL,
    correct_count       SMALLINT NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMPTZ,
    CONSTRAINT quiz_sessions_status_check
        CHECK (status IN ('active', 'completed', 'abandoned')),
    CONSTRAINT quiz_sessions_counts_check
        CHECK (requested_count > 0 AND total_count >= 0 AND correct_count >= 0 AND correct_count <= total_count)
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_started
    ON quiz_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS quiz_session_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id          BIGINT NOT NULL REFERENCES quiz_sessions (id) ON DELETE CASCADE,
    vocabulary_id       BIGINT NOT NULL REFERENCES vocabularies (id) ON DELETE CASCADE,
    position            SMALLINT NOT NULL,
    selection_group     VARCHAR(15) NOT NULL,
    question_type       VARCHAR(20) NOT NULL,
    prompt              TEXT NOT NULL,
    correct_answer      TEXT NOT NULL,
    choices             JSONB NOT NULL DEFAULT '[]'::jsonb,
    result              VARCHAR(10),
    answered_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_session_items_position_unique UNIQUE (session_id, position),
    CONSTRAINT quiz_session_items_vocabulary_unique UNIQUE (session_id, vocabulary_id),
    CONSTRAINT quiz_session_items_group_check
        CHECK (selection_group IN ('due', 'new', 'mastered', 'weak', 'fallback')),
    CONSTRAINT quiz_session_items_type_check
        CHECK (question_type IN ('multiple_choice', 'recall', 'context')),
    CONSTRAINT quiz_session_items_result_check
        CHECK (result IS NULL OR result IN ('correct', 'incorrect'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_session_items_session_position
    ON quiz_session_items (session_id, position);

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS quiz_session_id BIGINT REFERENCES quiz_sessions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS quiz_session_item_id BIGINT REFERENCES quiz_session_items (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS question_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS mastery_level_before SMALLINT,
    ADD COLUMN IF NOT EXISTS mastery_level_after SMALLINT,
    ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_session_item_unique
    ON quizzes (quiz_session_item_id)
    WHERE quiz_session_item_id IS NOT NULL;

COMMIT;
