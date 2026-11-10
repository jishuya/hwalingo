ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS quiz_question_count SMALLINT NOT NULL DEFAULT 10;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_quiz_question_count_check'
    ) THEN
        ALTER TABLE user_settings
            ADD CONSTRAINT user_settings_quiz_question_count_check
            CHECK (quiz_question_count IN (5, 10, 20, 30));
    END IF;
END $$;
