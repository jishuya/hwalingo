BEGIN;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(15) NOT NULL DEFAULT 'standard'
    CHECK (mode IN ('standard', 'incorrect'));
COMMIT;
