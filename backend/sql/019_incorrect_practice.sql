BEGIN;

ALTER TABLE vocabulary_progress ADD COLUMN IF NOT EXISTS incorrect_practice_excluded_at TIMESTAMPTZ;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS practice_version SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS practice_vocabulary_ids BIGINT[];
ALTER TABLE quiz_session_items ADD COLUMN IF NOT EXISTS practice_excluded BOOLEAN NOT NULL DEFAULT FALSE;
-- A practice session contains the whole selected set, independently of normal quiz presets.
ALTER TABLE quiz_sessions ALTER COLUMN requested_count TYPE INTEGER,
  ALTER COLUMN total_count TYPE INTEGER, ALTER COLUMN correct_count TYPE INTEGER;
ALTER TABLE quiz_session_items ALTER COLUMN position TYPE INTEGER;

-- Quarantine only active incorrect sessions explicitly identified by the demo manifest.
-- Keep their answers and all real standard sessions intact.
UPDATE quiz_sessions s SET status='abandoned',completed_at=CURRENT_TIMESTAMP
WHERE s.mode='incorrect' AND s.status='active' AND EXISTS (
  SELECT 1 FROM xp_events x WHERE x.user_id=s.user_id
    AND x.metadata->>'purpose'='fixture-manifest'
    AND x.metadata->'session_ids' @> jsonb_build_array(s.id)
);
COMMIT;
