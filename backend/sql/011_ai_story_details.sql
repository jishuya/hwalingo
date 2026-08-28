BEGIN;

ALTER TABLE ai_stories
    ADD COLUMN IF NOT EXISTS story_data JSONB,
    ADD COLUMN IF NOT EXISTS vocabulary_ids BIGINT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS language_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS genre VARCHAR(20),
    ADD COLUMN IF NOT EXISTS story_length VARCHAR(10),
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_ai_stories_user_vocabulary_ids
    ON ai_stories USING GIN (vocabulary_ids);

COMMIT;
