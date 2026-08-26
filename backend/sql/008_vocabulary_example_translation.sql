BEGIN;

ALTER TABLE vocabularies
    ADD COLUMN IF NOT EXISTS example_translation TEXT;

COMMIT;
