BEGIN;

ALTER TABLE quiz_session_items
    DROP CONSTRAINT IF EXISTS quiz_session_items_type_check;

ALTER TABLE quiz_session_items
    ADD CONSTRAINT quiz_session_items_type_check
        CHECK (question_type IN ('multiple_choice', 'recall', 'context', 'translation')),
    ADD COLUMN IF NOT EXISTS acceptable_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS explanation TEXT,
    ADD COLUMN IF NOT EXISTS generation_source VARCHAR(15) NOT NULL DEFAULT 'deterministic';

ALTER TABLE quiz_session_items
    DROP CONSTRAINT IF EXISTS quiz_session_items_generation_source_check;

ALTER TABLE quiz_session_items
    ADD CONSTRAINT quiz_session_items_generation_source_check
        CHECK (generation_source IN ('deterministic', 'ai'));

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS ai_feedback JSONB;

COMMIT;
