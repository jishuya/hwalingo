BEGIN;

-- 이전에 다른 시간대를 선택한 사용자의 일별 집계를 한국 시간으로 재구성한다.
CREATE TEMP TABLE changed_timezone_users ON COMMIT DROP AS
SELECT user_id FROM user_settings WHERE timezone <> 'Asia/Seoul';

DELETE FROM user_learning_days
WHERE user_id IN (SELECT user_id FROM changed_timezone_users);

WITH activities AS (
    SELECT la.user_id, (la.activity_at AT TIME ZONE 'Asia/Seoul')::date AS day,
           count(*)::integer AS activity_count
    FROM learning_activities la
    JOIN changed_timezone_users u ON u.user_id = la.user_id
    GROUP BY la.user_id, (la.activity_at AT TIME ZONE 'Asia/Seoul')::date
), answers AS (
    SELECT q.user_id, (q.answered_at AT TIME ZONE 'Asia/Seoul')::date AS day,
           sum(q.xp_earned)::integer AS earned_xp, count(*)::integer AS reviewed_word_count
    FROM quizzes q
    JOIN changed_timezone_users u ON u.user_id = q.user_id
    WHERE q.result IN ('correct', 'incorrect')
    GROUP BY q.user_id, (q.answered_at AT TIME ZONE 'Asia/Seoul')::date
)
INSERT INTO user_learning_days (user_id, learning_date, activity_count, earned_xp, reviewed_word_count)
SELECT COALESCE(a.user_id, q.user_id), COALESCE(a.day, q.day),
       COALESCE(a.activity_count, q.reviewed_word_count, 0),
       COALESCE(q.earned_xp, 0), COALESCE(q.reviewed_word_count, 0)
FROM activities a FULL JOIN answers q ON q.user_id = a.user_id AND q.day = a.day;

-- 컬럼은 이전 버전과의 호환을 위해 유지하되 더 이상 설정으로 사용하지 않는다.
UPDATE user_settings SET timezone = 'Asia/Seoul' WHERE timezone <> 'Asia/Seoul';

COMMIT;
