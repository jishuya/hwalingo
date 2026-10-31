-- seed_learning_graph_demo.sql로 생성한 전용 테스트 계정만 삭제합니다.
-- 비밀번호나 이름이 변경된 경우 다른 계정으로 간주하여 중단합니다.
BEGIN;
SELECT pg_advisory_xact_lock(20361031, 18);
DO $$
DECLARE demo_id BIGINT;
BEGIN
  SELECT id INTO demo_id FROM users WHERE email='graph-demo@example.test' FOR UPDATE;
  IF demo_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=demo_id AND display_name='그래프테스트'
    AND password_hash='$2b$10$BHLftg2eoS14SJJMY5.0A.oxzC380KC3Kcq2usQwgjZPw3LqA9KI6') THEN
    RAISE EXCEPTION '전용 테스트 계정 표식이 다르므로 삭제하지 않습니다.';
  END IF;
  DELETE FROM users WHERE id=demo_id;
END $$;
COMMIT;
