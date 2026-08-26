BEGIN;

ALTER TABLE vocabularies
    ADD COLUMN IF NOT EXISTS user_id BIGINT,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 이전 구현의 favorite 링크는 실제로 단어장 소유 관계였으므로 소유자를 이전한다.
UPDATE vocabularies v
SET user_id = owner.user_id
FROM (
    SELECT vocabulary_id, min(user_id) AS user_id
    FROM favorite_vocabularies
    GROUP BY vocabulary_id
) owner
WHERE owner.vocabulary_id = v.id AND v.user_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM vocabularies WHERE user_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot migrate vocabularies without an owning user';
    END IF;
END $$;

ALTER TABLE vocabularies
    ALTER COLUMN user_id SET NOT NULL,
    DROP CONSTRAINT IF EXISTS vocabularies_language_word_unique;

ALTER TABLE vocabularies
    ADD CONSTRAINT vocabularies_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    ADD CONSTRAINT vocabularies_user_language_word_unique
        UNIQUE (user_id, language_code, word);

CREATE INDEX IF NOT EXISTS idx_vocabularies_user_active
    ON vocabularies (user_id, created_at DESC)
    WHERE archived_at IS NULL;

-- 이전 링크는 하트가 아니라 단어장 저장을 뜻했으므로 하트 상태로 승계하지 않는다.
DELETE FROM favorite_vocabularies;

ALTER TABLE favorite_vocabularies
    DROP CONSTRAINT IF EXISTS favorite_vocabularies_unique,
    DROP CONSTRAINT IF EXISTS favorite_vocabularies_user_fk,
    DROP COLUMN IF EXISTS user_id;

ALTER TABLE favorite_vocabularies
    ADD CONSTRAINT favorite_vocabularies_vocabulary_unique UNIQUE (vocabulary_id);

COMMIT;
