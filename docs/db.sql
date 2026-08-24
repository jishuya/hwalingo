BEGIN;

-- =========================================================
-- 1. 사용자
-- =========================================================
CREATE TABLE users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    profile_image_url TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. 어휘
-- =========================================================
CREATE TABLE vocabularies (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    language_code   VARCHAR(10) NOT NULL DEFAULT 'en',
    word            VARCHAR(255) NOT NULL,
    meaning         TEXT NOT NULL,
    context_meaning TEXT,
    cefr_level      VARCHAR(2),
    etymology       TEXT,
    memory_tip      TEXT,
    example_sentence TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT vocabularies_cefr_level_check
        CHECK (
            cefr_level IS NULL
            OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
        ),

    CONSTRAINT vocabularies_language_word_unique
        UNIQUE (language_code, word)
);

-- 단어 검색용
CREATE INDEX idx_vocabularies_word
    ON vocabularies (word);


-- =========================================================
-- 3. 즐겨찾기 단어장
-- =========================================================
CREATE TABLE favorite_vocabularies (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    vocabulary_id   BIGINT NOT NULL,
    saved_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT favorite_vocabularies_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT favorite_vocabularies_vocabulary_fk
        FOREIGN KEY (vocabulary_id)
        REFERENCES vocabularies (id)
        ON DELETE CASCADE,

    CONSTRAINT favorite_vocabularies_unique
        UNIQUE (user_id, vocabulary_id)
);

-- UNIQUE(user_id, vocabulary_id)가 사용자별 단어장 조회 인덱스 역할도 수행
-- 특정 단어를 즐겨찾기한 사용자 조회 및 FK 삭제 성능용
CREATE INDEX idx_favorite_vocabularies_vocabulary_id
    ON favorite_vocabularies (vocabulary_id);


-- =========================================================
-- 4. 퀴즈 기록
-- =========================================================
CREATE TABLE quizzes (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL,
    vocabulary_id       BIGINT NOT NULL,
    submitted_answer    TEXT,
    result              VARCHAR(10) NOT NULL,
    used_hint           BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_ms    INTEGER,
    answered_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT quizzes_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT quizzes_vocabulary_fk
        FOREIGN KEY (vocabulary_id)
        REFERENCES vocabularies (id)
        ON DELETE CASCADE,

    CONSTRAINT quizzes_result_check
        CHECK (result IN ('correct', 'incorrect', 'pass', 'revealed')),

    CONSTRAINT quizzes_response_time_check
        CHECK (response_time_ms IS NULL OR response_time_ms >= 0)
);

-- 사용자별 최근 퀴즈 기록 조회
CREATE INDEX idx_quizzes_user_answered_at
    ON quizzes (user_id, answered_at DESC);

-- 단어별 정답률 및 오답 통계 계산
CREATE INDEX idx_quizzes_vocabulary_result
    ON quizzes (vocabulary_id, result);


-- =========================================================
-- 5. 학습 활동
-- =========================================================
CREATE TABLE learning_activities (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL,
    activity_type       VARCHAR(30) NOT NULL,
    duration_seconds    INTEGER NOT NULL DEFAULT 0,
    activity_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT learning_activities_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT learning_activities_type_check
        CHECK (
            activity_type IN (
                'analysis',
                'vocabulary',
                'quiz',
                'story'
            )
        ),

    CONSTRAINT learning_activities_duration_check
        CHECK (duration_seconds >= 0)
);

-- 사용자별 활동 내역, 학습 시간, 스트릭 계산
CREATE INDEX idx_learning_activities_user_activity_at
    ON learning_activities (user_id, activity_at DESC);


-- =========================================================
-- 6. AI 스토리
-- =========================================================
CREATE TABLE ai_stories (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL,
    title               TEXT NOT NULL,
    english_content     TEXT NOT NULL,
    korean_translation  TEXT,
    used_words          TEXT[] NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ai_stories_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

-- 사용자별 생성 스토리 목록 조회
CREATE INDEX idx_ai_stories_user_created_at
    ON ai_stories (user_id, created_at DESC);


-- =========================================================
-- 7. 사용자 설정
-- =========================================================
CREATE TABLE user_settings (
    user_id                 BIGINT PRIMARY KEY,
    theme                   VARCHAR(10) NOT NULL DEFAULT 'light',
    interface_language      VARCHAR(10) NOT NULL DEFAULT 'ko',
    target_language         VARCHAR(10) NOT NULL DEFAULT 'en',
    notifications_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT user_settings_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT user_settings_theme_check
        CHECK (theme IN ('light', 'dark', 'system'))
);

COMMIT;