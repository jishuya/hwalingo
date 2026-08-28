BEGIN;

CREATE TABLE ai_response_cache (
    user_id       BIGINT NOT NULL,
    operation     VARCHAR(50) NOT NULL,
    cache_key     CHAR(64) NOT NULL,
    response_data JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (user_id, operation, cache_key),
    CONSTRAINT ai_response_cache_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_response_cache_expires_at
    ON ai_response_cache (expires_at);

COMMIT;
