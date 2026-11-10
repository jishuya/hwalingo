BEGIN;

CREATE TABLE IF NOT EXISTS vocabulary_progress (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL,
    vocabulary_id       BIGINT NOT NULL,
    mastery_level       SMALLINT NOT NULL DEFAULT 0,
    mastery_score       NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_attempts      INTEGER NOT NULL DEFAULT 0,
    correct_count       INTEGER NOT NULL DEFAULT 0,
    incorrect_count     INTEGER NOT NULL DEFAULT 0,
    correct_streak      INTEGER NOT NULL DEFAULT 0,
    incorrect_streak    INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at    TIMESTAMPTZ,
    next_review_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mastered_at         TIMESTAMPTZ,
    algorithm_version   VARCHAR(30) NOT NULL DEFAULT 'fixed-v1',
    algorithm_state     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT vocabulary_progress_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT vocabulary_progress_vocabulary_fk
        FOREIGN KEY (vocabulary_id) REFERENCES vocabularies (id) ON DELETE CASCADE,
    CONSTRAINT vocabulary_progress_unique
        UNIQUE (user_id, vocabulary_id),
    CONSTRAINT vocabulary_progress_mastery_level_check
        CHECK (mastery_level BETWEEN 0 AND 7),
    CONSTRAINT vocabulary_progress_mastery_score_check
        CHECK (mastery_score BETWEEN 0 AND 100),
    CONSTRAINT vocabulary_progress_counts_check
        CHECK (
            total_attempts >= 0
            AND correct_count >= 0
            AND incorrect_count >= 0
            AND correct_streak >= 0
            AND incorrect_streak >= 0
            AND total_attempts = correct_count + incorrect_count
        )
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_progress_due
    ON vocabulary_progress (user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_vocabulary_progress_mastery
    ON vocabulary_progress (user_id, mastery_level);

-- 기존 즐겨찾기도 바로 테스트 대상이 될 수 있도록 최초 진행도를 만든다.
INSERT INTO vocabulary_progress (user_id, vocabulary_id)
SELECT user_id, vocabulary_id
FROM favorite_vocabularies
ON CONFLICT (user_id, vocabulary_id) DO NOTHING;

COMMIT;
