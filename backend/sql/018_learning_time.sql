BEGIN;
CREATE TABLE IF NOT EXISTS learning_time_events (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('analysis','vocabulary','quiz','story')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id),
  CHECK (ended_at > started_at AND ended_at <= started_at + interval '30 seconds')
);
CREATE INDEX IF NOT EXISTS learning_time_events_user_start ON learning_time_events(user_id, started_at);
CREATE TABLE IF NOT EXISTS learning_time_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  measurement_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
