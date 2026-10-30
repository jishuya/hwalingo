BEGIN;

ALTER TABLE quiz_session_items
    ADD COLUMN IF NOT EXISTS retry_of_item_id BIGINT REFERENCES quiz_session_items (id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
    ALTER COLUMN position TYPE INTEGER,
    DROP CONSTRAINT IF EXISTS quiz_session_items_vocabulary_unique;

-- 기본 문제는 단어당 한 번, 대기 중인 문제도 단어당 한 번만 존재한다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_items_original_vocabulary
    ON quiz_session_items (session_id, vocabulary_id) WHERE retry_of_item_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_items_pending_vocabulary
    ON quiz_session_items (session_id, vocabulary_id) WHERE result IS NULL;

COMMIT;
