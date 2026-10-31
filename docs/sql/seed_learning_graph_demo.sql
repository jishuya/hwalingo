-- 그래프 전용 테스트 계정 생성/초기화. 기존 사용자의 데이터는 수정하지 않습니다.
-- 선행 조건: 앱 마이그레이션(특히 003,004,005,015,018) 적용.
-- 로그인: graph-demo@example.test / GraphDemo!2026
-- 재실행하면 이 테스트 계정의 기존 학습 데이터를 초기화하고 오늘 기준으로 재생성합니다.
-- 아래 이메일은 다른 용도로 사용하지 마세요. 예상 값은 파일 끝 SELECT 결과에서 확인합니다.
BEGIN;
SELECT pg_advisory_xact_lock(20361031, 18);
DO $$
DECLARE
  demo_id BIGINT;
  demo_hash CONSTANT TEXT := '$2b$10$BHLftg2eoS14SJJMY5.0A.oxzC380KC3Kcq2usQwgjZPw3LqA9KI6';
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date;
  word_ids BIGINT[];
  word_id BIGINT;
  quiz_id BIGINT;
  new_index INTEGER := 11;
  day_offset INTEGER;
  activity_total INTEGER;
  j INTEGER;
  outcome TEXT;
  at_time TIMESTAMPTZ;
  base_time TIMESTAMPTZ;
  target_seconds INTEGER;
  chunk_start TIMESTAMPTZ;
  r RECORD;
BEGIN
  SELECT id INTO demo_id FROM users WHERE email = 'graph-demo@example.test' FOR UPDATE;
  IF demo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = demo_id AND display_name = '그래프테스트' AND password_hash = demo_hash
  ) THEN
    RAISE EXCEPTION '동일 이메일의 다른 계정이 있어 중단합니다. 기존 계정은 수정하지 않습니다.';
  END IF;
  IF demo_id IS NULL THEN
    INSERT INTO users(email,password_hash,display_name)
    VALUES ('graph-demo@example.test',demo_hash,'그래프테스트') RETURNING id INTO demo_id;
  END IF;

  DELETE FROM xp_events WHERE user_id = demo_id;
  DELETE FROM quizzes WHERE user_id = demo_id;
  DELETE FROM quiz_sessions WHERE user_id = demo_id;
  DELETE FROM vocabulary_progress WHERE user_id = demo_id;
  DELETE FROM vocabularies WHERE user_id = demo_id;
  DELETE FROM learning_activities WHERE user_id = demo_id;
  DELETE FROM user_learning_days WHERE user_id = demo_id;
  DELETE FROM learning_time_events WHERE user_id = demo_id;
  DELETE FROM learning_time_settings WHERE user_id = demo_id;

  INSERT INTO user_settings(user_id,weekly_goal_days,timezone)
  VALUES (demo_id,5,'Asia/Seoul') ON CONFLICT (user_id) DO UPDATE
    SET weekly_goal_days = 5, timezone = 'Asia/Seoul';
  INSERT INTO user_progress(user_id,total_xp) VALUES (demo_id,0)
    ON CONFLICT (user_id) DO UPDATE SET total_xp = 0;

  FOR j IN 1..50 LOOP
    INSERT INTO vocabularies(user_id,language_code,word,meaning,cefr_level,created_at)
    VALUES (demo_id,'en','graph-demo-' || lpad(j::text,3,'0'),'그래프 테스트 어휘 ' || j,'B1',
      (today - 180)::timestamp AT TIME ZONE 'Asia/Seoul') RETURNING id INTO word_id;
    word_ids := array_append(word_ids,word_id);
  END LOOP;

  -- 복습용 10개는 조회 기간 이전의 첫 답안을 먼저 만듭니다.
  FOR j IN 1..10 LOOP
    INSERT INTO quizzes(user_id,vocabulary_id,result,answered_at)
    VALUES (demo_id,word_ids[j],'correct',(today - 100)::timestamp AT TIME ZONE 'Asia/Seoul');
  END LOOP;

  -- 일별 예상: (오늘로부터 며칠 전, 새 단어, 복습, 정답, 기본 학습 초)
  FOR r IN SELECT * FROM (VALUES
    (6,4,0,0,0), (5,3,5,8,120), (4,0,0,0,0),
    (3,2,8,7,450), (2,1,3,2,900), (1,0,6,3,60), (0,5,5,9,180)
  ) AS plan(offset_days,new_count,review_count,correct_count,seconds) LOOP
    base_time := (today - r.offset_days)::timestamp AT TIME ZONE 'Asia/Seoul';
    FOR j IN 1..(r.new_count + r.review_count) LOOP
      IF j <= r.new_count THEN
        word_id := word_ids[new_index];
        new_index := new_index + 1;
      ELSE
        word_id := word_ids[1 + ((j - r.new_count - 1) % 10)];
      END IF;
      outcome := CASE WHEN j <= r.correct_count THEN 'correct' ELSE 'incorrect' END;
      -- 오늘 답안도 미래 시각을 만들지 않습니다. 보통 09:00, 자정 직후는 현재 이전으로 배치합니다.
      at_time := LEAST(base_time + interval '9 hours' + j * interval '1 second', CURRENT_TIMESTAMP - interval '1 millisecond');
      INSERT INTO quizzes(user_id,vocabulary_id,result,answered_at,response_time_ms,xp_earned)
      VALUES (demo_id,word_id,outcome,at_time,3000,CASE WHEN outcome='correct' THEN 10 ELSE 0 END)
      RETURNING id INTO quiz_id;
      INSERT INTO learning_activities(user_id,activity_type,activity_at) VALUES (demo_id,'quiz',at_time);
      IF outcome = 'correct' THEN
        INSERT INTO xp_events(user_id,quiz_id,event_type,amount,created_at)
        VALUES (demo_id,quiz_id,'quiz_review',10,at_time);
      END IF;
    END LOOP;

    -- 20초 구간으로 기록합니다. 오늘은 실제 경과 시간까지만 생성합니다.
    target_seconds := r.seconds;
    IF r.offset_days = 0 THEN
      target_seconds := LEAST(target_seconds, GREATEST(0, floor(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP - base_time))::integer - 20));
    END IF;
    -- 자정 경계 테스트와 겹치지 않게 00:00:20 이후에 배치합니다.
    base_time := base_time + interval '20 seconds';
    IF target_seconds > 0 THEN
      FOR j IN 0..((target_seconds - 1) / 20) LOOP
        chunk_start := base_time + (j * 20) * interval '1 second';
        INSERT INTO learning_time_events(user_id,event_id,activity_type,started_at,ended_at)
        VALUES (demo_id,md5('graph-demo-time-' || r.offset_days || '-' || j)::uuid,
          (ARRAY['analysis','vocabulary','quiz','story'])[1 + (j % 4)],chunk_start,
          LEAST(chunk_start + interval '20 seconds',base_time + target_seconds * interval '1 second'));
      END LOOP;
      -- 다른 기기의 동시 학습을 가정한 중복 20초. 그래프 합계에는 가산되지 않습니다.
      INSERT INTO learning_time_events(user_id,event_id,activity_type,started_at,ended_at)
      VALUES (demo_id,md5('graph-demo-overlap-' || r.offset_days)::uuid,'quiz',base_time,
        base_time + LEAST(target_seconds,20) * interval '1 second');
    END IF;
  END LOOP;

  -- 오늘 자정을 넘는 20초. 어제 10초, 오늘 최대 10초로 나뉩니다.
  base_time := today::timestamp AT TIME ZONE 'Asia/Seoul';
  INSERT INTO learning_time_events(user_id,event_id,activity_type,started_at,ended_at)
  VALUES (demo_id,md5('graph-demo-midnight')::uuid,'story',base_time - interval '10 seconds',
    LEAST(base_time + interval '10 seconds',CURRENT_TIMESTAMP));
  INSERT INTO learning_time_settings(user_id,measurement_started_at)
  VALUES (demo_id,(today - 5)::timestamp AT TIME ZONE 'Asia/Seoul');

  -- 연간 농도: 0/2/8/20/35회. 최근 7일은 빈 날짜를 유지합니다.
  FOR day_offset IN 7..364 LOOP
    activity_total := (ARRAY[0,2,8,20,35,0,0])[1 + (day_offset % 7)];
    INSERT INTO learning_activities(user_id,activity_type,activity_at)
    SELECT demo_id,'analysis',(today - day_offset)::timestamp AT TIME ZONE 'Asia/Seoul'
      + interval '12 hours' + n * interval '1 second'
    FROM generate_series(1,activity_total) AS n;
  END LOOP;
  -- 과거 첫 답안 10건에도 대응하는 활동을 생성합니다.
  INSERT INTO learning_activities(user_id,activity_type,activity_at)
  SELECT demo_id,'quiz',answered_at FROM quizzes
  WHERE user_id = demo_id AND answered_at < (today - 6)::timestamp AT TIME ZONE 'Asia/Seoul';

  INSERT INTO user_learning_days(user_id,learning_date,activity_count,earned_xp,reviewed_word_count)
  SELECT demo_id,(a.activity_at AT TIME ZONE 'Asia/Seoul')::date,count(*)::integer,0,0
  FROM learning_activities a WHERE a.user_id = demo_id GROUP BY (a.activity_at AT TIME ZONE 'Asia/Seoul')::date;
  UPDATE user_learning_days d SET earned_xp = q.xp, reviewed_word_count = q.answers
  FROM (SELECT (answered_at AT TIME ZONE 'Asia/Seoul')::date AS day,sum(xp_earned)::integer AS xp,count(*)::integer AS answers
    FROM quizzes WHERE user_id = demo_id GROUP BY (answered_at AT TIME ZONE 'Asia/Seoul')::date) q
  WHERE d.user_id = demo_id AND d.learning_date = q.day;
  UPDATE user_progress SET total_xp = (SELECT COALESCE(sum(amount),0) FROM xp_events WHERE user_id = demo_id) WHERE user_id = demo_id;

  INSERT INTO vocabulary_progress(user_id,vocabulary_id,total_attempts,correct_count,incorrect_count,last_reviewed_at,next_review_at,mastery_level)
  SELECT demo_id,v.id,count(q.id)::integer,count(q.id) FILTER(WHERE q.result='correct')::integer,
    count(q.id) FILTER(WHERE q.result='incorrect')::integer,max(q.answered_at),CURRENT_TIMESTAMP,
    LEAST(7,count(q.id) FILTER(WHERE q.result='correct'))::smallint
  FROM vocabularies v LEFT JOIN quizzes q ON q.vocabulary_id = v.id AND q.user_id = demo_id
  WHERE v.user_id = demo_id GROUP BY v.id;
END $$;

-- 실제 일별 기대값입니다. 0%와 기록 없음(NULL)을 구분합니다.
WITH history AS (
  SELECT q.*,row_number() OVER(PARTITION BY q.vocabulary_id ORDER BY q.answered_at,q.id) AS attempt
  FROM quizzes q JOIN users u ON u.id=q.user_id WHERE u.email='graph-demo@example.test'
), days AS (
  SELECT generate_series((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 6,
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date,interval '1 day')::date AS day
)
SELECT d.day AS learning_date,
  count(h.id) FILTER(WHERE attempt=1) AS new_answers,
  count(h.id) FILTER(WHERE attempt>1) AS review_answers,
  count(h.id) FILTER(WHERE result='correct') AS correct_answers,
  round(100.0 * count(h.id) FILTER(WHERE result='correct') / NULLIF(count(h.id),0)) AS accuracy_percent
FROM days d LEFT JOIN history h ON (h.answered_at AT TIME ZONE 'Asia/Seoul')::date=d.day GROUP BY d.day ORDER BY d.day;
COMMIT;
