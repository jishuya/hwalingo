-- 최근 성장한 단어 그래프 예시. 기존 그래프 SQL과 독립적으로 한 번 실행합니다.
-- 대상: jishuya3015@naver.com. 실제 DB에는 수동 실행합니다.
-- 실제 어휘 5개와 정답 이력을 추가하며 기존 단어/답안/XP/진행 테스트는 수정하지 않습니다.
-- 0 XP manifest로 중복 실행을 차단하고 생성한 단어/답안 ID를 보관합니다.
BEGIN;
SELECT pg_advisory_xact_lock(20361031, 20);
CREATE TEMP TABLE word_growth_seed_words(id BIGINT PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE word_growth_seed_answers(id BIGINT PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE word_growth_seed_activities(id BIGINT PRIMARY KEY) ON COMMIT DROP;
DO $$
DECLARE
  target_id BIGINT;
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date;
  entry RECORD;
  word_id BIGINT; answer_id BIGINT; activity_id BIGINT;
  level INTEGER; elapsed_days INTEGER; at_time TIMESTAMPTZ;
BEGIN
  SELECT id INTO target_id FROM users WHERE email='jishuya3015@naver.com' FOR UPDATE;
  IF target_id IS NULL THEN RAISE EXCEPTION '대상 계정을 찾지 못했습니다.'; END IF;
  IF EXISTS (SELECT 1 FROM xp_events WHERE user_id=target_id AND metadata->>'seed'='word-growth-v1') THEN
    RAISE EXCEPTION '최근 성장한 단어 예시가 이미 추가되어 있습니다.';
  END IF;
  FOR entry IN SELECT * FROM (VALUES
    ('en','resourcefulness','어려운 상황에서 해결책을 찾아내는 능력','Her resourcefulness helped the team solve the problem.','그녀의 문제 해결 능력은 팀이 문제를 푸는 데 도움이 되었어요.',4),
    ('fr','persévérance','끈기, 인내','Sa persévérance lui permet de progresser.','그의 끈기는 꾸준히 발전하는 힘이 돼요.',3),
    ('ja','積み重ね','차곡차곡 쌓아 올림, 축적','毎日の積み重ねが大切です。','매일 차곡차곡 쌓아 가는 것이 중요해요.',3),
    ('zh','循序渐进','차례대로 점진적으로 나아가다','学习需要循序渐进。','학습은 차근차근 나아가는 과정이 필요해요.',2),
    ('ko','고양','정신이나 의식 등을 높임','독서는 사고력 고양에 도움이 돼요.','독서는 사고력 고양에 도움이 돼요.',1)
  ) AS samples(language,word,meaning,example,translation,final_level) LOOP
    IF EXISTS (SELECT 1 FROM vocabularies WHERE user_id=target_id AND language_code=entry.language AND lower(word)=lower(entry.word)) THEN
      RAISE EXCEPTION '이미 저장된 예시 단어가 있습니다: %. 기존 단어 보호를 위해 전체 취소합니다.',entry.word;
    END IF;
    INSERT INTO vocabularies(user_id,language_code,word,meaning,example_sentence,example_translation,created_at)
    VALUES(target_id,entry.language,entry.word,entry.meaning,entry.example,entry.translation,
      (today-21)::timestamp AT TIME ZONE 'Asia/Seoul') RETURNING id INTO word_id;
    INSERT INTO word_growth_seed_words VALUES(word_id);
    elapsed_days := 0;
    FOR level IN 1..entry.final_level LOOP
      IF level>1 THEN elapsed_days := elapsed_days+(ARRAY[0,1,3,7])[level]; END IF;
      at_time := (today-20+elapsed_days)::timestamp AT TIME ZONE 'Asia/Seoul'+interval '12 hours';
      INSERT INTO quizzes(user_id,vocabulary_id,result,answered_at,mastery_level_before,mastery_level_after,next_review_at,xp_earned)
      VALUES(target_id,word_id,'correct',at_time,level-1,level,
        at_time+(ARRAY[1,3,7,14])[level]*interval '1 day',0) RETURNING id INTO answer_id;
      INSERT INTO word_growth_seed_answers VALUES(answer_id);
      INSERT INTO learning_activities(user_id,activity_type,activity_at)
      VALUES(target_id,'quiz',at_time) RETURNING id INTO activity_id;
      INSERT INTO word_growth_seed_activities VALUES(activity_id);
    END LOOP;
    INSERT INTO vocabulary_progress(user_id,vocabulary_id,mastery_level,total_attempts,correct_count,
      correct_streak,last_reviewed_at,next_review_at,created_at)
    VALUES(target_id,word_id,entry.final_level,entry.final_level,entry.final_level,entry.final_level,
      at_time,at_time+(ARRAY[1,3,7,14])[entry.final_level]*interval '1 day',
      (today-21)::timestamp AT TIME ZONE 'Asia/Seoul');
  END LOOP;
  INSERT INTO user_learning_days(user_id,learning_date,activity_count,earned_xp,reviewed_word_count)
  SELECT target_id,(q.answered_at AT TIME ZONE 'Asia/Seoul')::date,count(*)::integer,0,count(*)::integer
  FROM quizzes q JOIN word_growth_seed_answers s ON s.id=q.id GROUP BY 2
  ON CONFLICT(user_id,learning_date) DO UPDATE SET
    activity_count=user_learning_days.activity_count+EXCLUDED.activity_count,
    reviewed_word_count=user_learning_days.reviewed_word_count+EXCLUDED.reviewed_word_count;
  INSERT INTO xp_events(user_id,event_type,amount,metadata)
  VALUES(target_id,'bonus',0,jsonb_build_object('seed','word-growth-v1','purpose','fixture-manifest',
    'vocabulary_ids',(SELECT jsonb_agg(id) FROM word_growth_seed_words),
    'quiz_ids',(SELECT jsonb_agg(id) FROM word_growth_seed_answers),
    'activity_ids',(SELECT jsonb_agg(id) FROM word_growth_seed_activities)));
END $$;
SELECT v.word,v.language_code,0 AS before_level,p.mastery_level AS current_level,
  p.mastery_level AS gained FROM word_growth_seed_words s
JOIN vocabularies v ON v.id=s.id JOIN vocabulary_progress p ON p.vocabulary_id=v.id
ORDER BY gained DESC,v.word,v.id;
COMMIT;
