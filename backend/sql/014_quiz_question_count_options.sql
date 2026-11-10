BEGIN;

ALTER TABLE user_settings
    DROP CONSTRAINT IF EXISTS user_settings_quiz_question_count_check;

UPDATE user_settings SET quiz_question_count = 10 WHERE quiz_question_count = 5;

ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_quiz_question_count_check
    CHECK (quiz_question_count IN (10, 20, 30, 40));

COMMIT;
