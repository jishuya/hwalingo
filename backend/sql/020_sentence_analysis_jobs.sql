BEGIN;

CREATE TABLE IF NOT EXISTS sentence_analysis_jobs (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ
);

-- One outstanding analysis per user also makes retried POST requests idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_jobs_active_user
    ON sentence_analysis_jobs(user_id) WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_queue
    ON sentence_analysis_jobs(created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_created
    ON sentence_analysis_jobs(user_id, created_at DESC);

COMMIT;
