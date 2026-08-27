BEGIN;

ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_user_fk;
ALTER TABLE quizzes ADD CONSTRAINT quizzes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE learning_activities DROP CONSTRAINT IF EXISTS learning_activities_user_fk;
ALTER TABLE learning_activities ADD CONSTRAINT learning_activities_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE ai_stories DROP CONSTRAINT IF EXISTS ai_stories_user_fk;
ALTER TABLE ai_stories ADD CONSTRAINT ai_stories_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_fk;
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

COMMIT;
