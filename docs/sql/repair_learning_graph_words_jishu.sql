-- 이미 넣은 숙련도 예시 40개와 앞선 영어 예시 50개의 가짜 단어만 실제 어휘로 교체합니다.
-- 단어 ID, 숙련도, 복습일, 정오답, XP, 활동/시간 기록은 유지합니다.
-- 기존에 저장한 실제 단어는 수정하지 않으며 중복이면 다른 실제 단어를 고릅니다.
-- 재실행해도 이미 교체된 단어는 변경하지 않습니다.
BEGIN;
SELECT pg_advisory_xact_lock(20361031,19);
CREATE TEMP TABLE graph_real_dictionary(language TEXT, ordinal INTEGER, word TEXT, meaning TEXT, example TEXT, translation TEXT, PRIMARY KEY(language,ordinal)) ON COMMIT DROP;
INSERT INTO graph_real_dictionary VALUES
('en',1,'resilience','회복력','She showed resilience after the failure.','그녀는 실패 후 회복력을 보여주었어요.'),
('en',2,'curiosity','호기심','Her curiosity led her to the library.','그녀는 호기심에 도서관을 찾았어요.'),
('en',3,'opportunity','기회','This is an opportunity to learn.','이것은 배울 수 있는 기회예요.'),
('en',4,'confidence','자신감','Practice gives me confidence.','연습은 저에게 자신감을 줘요.'),
('en',5,'patience','인내심','Teaching requires patience.','가르치는 일에는 인내심이 필요해요.'),
('en',6,'achievement','성취','Finishing the course was a great achievement.','그 과정을 마친 것은 큰 성취였어요.'),
('en',7,'perspective','관점','Travel can change your perspective.','여행은 관점을 바꿀 수 있어요.'),
('en',8,'commitment','헌신, 전념','Her commitment to learning is strong.','배움에 대한 그녀의 열의는 강해요.'),
('en',9,'balance','균형','I try to maintain a healthy balance.','저는 건강한 균형을 유지하려고 해요.'),
('en',10,'discovery','발견','The discovery surprised everyone.','그 발견은 모두를 놀라게 했어요.'),
('en',11,'cooperation','협력','The project needs cooperation.','그 프로젝트에는 협력이 필요해요.'),
('en',12,'gratitude','감사','He expressed his gratitude to the team.','그는 팀에 감사의 마음을 표현했어요.'),
('en',13,'determination','결단력, 굳은 의지','Her determination helped her succeed.','그녀의 굳은 의지가 성공에 도움이 되었어요.'),
('en',14,'awareness','인식','The lesson raised our awareness of the issue.','그 수업은 그 문제에 대한 우리의 인식을 높였어요.'),
('en',15,'adaptability','적응력','Adaptability is useful in a new environment.','적응력은 새로운 환경에서 유용해요.'),
('en',16,'encouragement','격려','Your encouragement means a lot to me.','당신의 격려는 저에게 큰 의미가 있어요.'),
('en',17,'journey','여정, 여행','Our journey began at sunrise.','우리의 여행은 해가 뜰 때 시작됐어요.'),
('en',18,'knowledge','지식','Reading expands our knowledge.','독서는 우리의 지식을 넓혀 줘요.'),
('en',19,'wisdom','지혜','She shared her wisdom with us.','그녀는 자신의 지혜를 우리와 나누었어요.'),
('en',20,'courage','용기','It takes courage to ask for help.','도움을 요청하려면 용기가 필요해요.'),
('en',21,'effort','노력','Your effort will make a difference.','당신의 노력은 변화를 만들 거예요.'),
('en',22,'progress','진전, 발전','We are making steady progress.','우리는 꾸준히 발전하고 있어요.'),
('en',23,'purpose','목적','Every activity has a clear purpose.','모든 활동에는 명확한 목적이 있어요.'),
('en',24,'habit','습관','Walking every morning is a good habit.','매일 아침 걷는 것은 좋은 습관이에요.'),
('en',25,'challenge','도전, 어려운 과제','I enjoy a new challenge.','저는 새로운 도전을 즐겨요.'),
('en',26,'creativity','창의성','Music encourages creativity.','음악은 창의성을 북돋워요.'),
('en',27,'imagination','상상력','The story captured my imagination.','그 이야기는 제 상상력을 사로잡았어요.'),
('en',28,'memory','기억','That song brings back a happy memory.','그 노래를 들으면 행복한 기억이 떠올라요.'),
('en',29,'attention','주의, 관심','Please pay attention to the instructions.','안내에 주의를 기울여 주세요.'),
('en',30,'focus','집중하다','I focus on one task at a time.','저는 한 번에 한 가지 일에 집중해요.'),
('en',31,'practice','연습','Regular practice helps me improve.','규칙적인 연습은 실력 향상에 도움이 돼요.'),
('en',32,'improvement','향상, 개선','I can see an improvement in my work.','저는 제 작업에서 향상된 점을 볼 수 있어요.'),
('en',33,'understanding','이해','The example deepened my understanding.','그 예시는 제 이해를 깊게 해 주었어요.'),
('en',34,'explanation','설명','Thank you for the clear explanation.','명확하게 설명해 주셔서 감사해요.'),
('en',35,'solution','해결책','We found a simple solution.','우리는 간단한 해결책을 찾았어요.'),
('en',36,'decision','결정','It was a difficult decision.','그것은 어려운 결정이었어요.'),
('en',37,'choice','선택','You have a choice.','당신에게는 선택권이 있어요.'),
('en',38,'responsibility','책임','We share the responsibility.','우리는 책임을 나누어 져요.'),
('en',39,'independence','독립, 자립','The experience gave her independence.','그 경험은 그녀가 자립할 수 있게 해 주었어요.'),
('en',40,'kindness','친절','His kindness made my day better.','그의 친절 덕분에 제 하루가 더 좋아졌어요.'),
('en',41,'generosity','너그러움, 관대함','We appreciate your generosity.','당신의 너그러움에 감사해요.'),
('en',42,'honesty','정직','Honesty builds trust.','정직은 신뢰를 쌓아요.'),
('en',43,'trust','신뢰','Trust grows through honest conversations.','신뢰는 솔직한 대화를 통해 자라나요.'),
('en',44,'respect','존중','We treat each other with respect.','우리는 서로를 존중하며 대해요.'),
('en',45,'empathy','공감','She listened with empathy.','그녀는 공감하며 이야기를 들었어요.'),
('en',46,'friendship','우정','Our friendship has lasted for years.','우리의 우정은 여러 해 동안 이어져 왔어요.'),
('en',47,'community','공동체, 지역 사회','The community welcomed the new family.','지역 사회는 새로 온 가족을 환영했어요.'),
('en',48,'conversation','대화','We had an interesting conversation.','우리는 흥미로운 대화를 나누었어요.'),
('en',49,'communication','의사소통','Good communication prevents confusion.','원활한 의사소통은 혼란을 막아 줘요.'),
('en',50,'expression','표현','I learned a useful expression.','저는 유용한 표현을 배웠어요.'),
('en',51,'pronunciation','발음','I practice my pronunciation every day.','저는 매일 발음을 연습해요.'),
('en',52,'vocabulary','어휘','Reading helps me build my vocabulary.','독서는 어휘를 늘리는 데 도움이 돼요.'),
('en',53,'sentence','문장','Please write a short sentence.','짧은 문장을 써 주세요.'),
('en',54,'meaning','의미','What is the meaning of this word?','이 단어의 뜻은 무엇인가요?'),
('en',55,'context','맥락','The context helps us understand the word.','맥락은 그 단어를 이해하는 데 도움이 돼요.'),
('en',56,'example','예시','Can you give me an example?','예를 하나 들어 주실 수 있나요?'),
('en',57,'question','질문','That is an important question.','그것은 중요한 질문이에요.'),
('en',58,'answer','대답, 답','I found the answer in the book.','저는 책에서 답을 찾았어요.'),
('en',59,'discuss','논의하다','We will discuss the idea tomorrow.','우리는 내일 그 생각을 논의할 거예요.'),
('en',60,'compare','비교하다','Compare the two pictures.','두 그림을 비교해 보세요.'),
('en',61,'describe','묘사하다, 설명하다','Can you describe the place?','그 장소를 설명해 주실 수 있나요?'),
('en',62,'explain','설명하다','Please explain the rule again.','그 규칙을 다시 설명해 주세요.'),
('en',63,'explore','탐험하다, 탐구하다','We explored the old town.','우리는 옛 시가지를 둘러보았어요.'),
('en',64,'observe','관찰하다','I like to observe birds in the park.','저는 공원에서 새를 관찰하는 것을 좋아해요.'),
('en',65,'notice','알아차리다','Did you notice the change?','변화를 알아차렸나요?'),
('en',66,'recognize','알아보다','I recognized her voice immediately.','저는 곧바로 그녀의 목소리를 알아들었어요.'),
('en',67,'remember','기억하다','I remember our first meeting.','저는 우리의 첫 만남을 기억해요.'),
('en',68,'review','복습하다, 검토하다','I review my notes after class.','저는 수업 후 필기를 복습해요.'),
('en',69,'improve','향상시키다','I want to improve my writing.','저는 글쓰기 실력을 향상시키고 싶어요.'),
('en',70,'develop','발전시키다, 개발하다','She wants to develop her skills.','그녀는 자신의 능력을 발전시키고 싶어 해요.'),
('en',71,'discover','발견하다','We discovered a quiet café.','우리는 조용한 카페를 발견했어요.'),
('en',72,'achieve','달성하다','You can achieve your goal.','당신은 목표를 달성할 수 있어요.'),
('en',73,'continue','계속하다','Please continue your story.','이야기를 계속해 주세요.'),
('en',74,'prepare','준비하다','I prepare my bag the night before.','저는 전날 밤에 가방을 준비해요.'),
('en',75,'organize','정리하다, 조직하다','I organize my notes by topic.','저는 주제별로 필기를 정리해요.'),
('en',76,'reflect','돌아보다, 성찰하다','I reflect on what I learned today.','저는 오늘 배운 것을 돌아봐요.'),
('en',77,'participate','참여하다','Everyone can participate in the activity.','누구나 그 활동에 참여할 수 있어요.'),
('en',78,'contribute','기여하다','Everyone can contribute an idea.','누구나 아이디어를 보탤 수 있어요.'),
('en',79,'collaborate','협력하다','We collaborate on creative projects.','우리는 창의적인 프로젝트에서 협력해요.'),
('en',80,'perseverance','인내, 끈기','Perseverance helped her finish the race.','끈기 덕분에 그녀는 경주를 마칠 수 있었어요.'),
('fr',1,'apprendre','배우다','Je veux apprendre le français.','저는 프랑스어를 배우고 싶어요.'),
('fr',2,'confiance','신뢰, 자신감','J’ai confiance en toi.','저는 당신을 믿어요.'),
('fr',3,'découverte','발견','Cette découverte est importante.','이 발견은 중요해요.'),
('fr',4,'habitude','습관','J’ai l’habitude de lire le soir.','저는 저녁에 책을 읽는 습관이 있어요.'),
('fr',5,'souvenir','추억, 기억','Ce souvenir me fait sourire.','이 추억은 저를 미소 짓게 해요.'),
('fr',6,'courage','용기','Il faut du courage pour commencer.','시작하려면 용기가 필요해요.'),
('fr',7,'progrès','진전, 발전','Tu fais des progrès chaque jour.','당신은 날마다 발전하고 있어요.'),
('fr',8,'équilibre','균형','Elle cherche un équilibre dans sa vie.','그녀는 삶의 균형을 찾고 있어요.'),
('fr',9,'espoir','희망','Nous gardons espoir.','우리는 희망을 간직하고 있어요.'),
('fr',10,'partage','나눔, 공유','Le partage nous rapproche.','나눔은 우리를 더 가깝게 해요.'),
('fr',11,'patience','인내심','Merci pour votre patience.','기다려 주셔서 감사해요.'),
('fr',12,'voyage','여행','Ce voyage me plaît beaucoup.','저는 이 여행이 정말 마음에 들어요.'),
('fr',13,'réussite','성공, 성취','Sa réussite nous inspire.','그의 성공은 우리에게 영감을 줘요.'),
('fr',14,'attention','주의, 관심','Fais attention à la marche.','계단을 조심하세요.'),
('fr',15,'avenir','미래','Elle pense à son avenir.','그녀는 자신의 미래를 생각하고 있어요.'),
('fr',16,'sourire','미소','Son sourire me rassure.','그의 미소는 저를 안심시켜 줘요.'),
('ja',1,'学ぶ','배우다','毎日、新しいことを学びます。','매일 새로운 것을 배워요.'),
('ja',2,'経験','경험','この経験は役に立ちます。','이 경험은 도움이 돼요.'),
('ja',3,'習慣','습관','毎朝、本を読む習慣があります。','매일 아침 책을 읽는 습관이 있어요.'),
('ja',4,'挑戦','도전','新しい仕事に挑戦します。','새로운 일에 도전해요.'),
('ja',5,'自信','자신감','練習を重ねて自信がつきました。','연습을 거듭해서 자신감이 생겼어요.'),
('ja',6,'成長','성장','子どもの成長は早いです。','아이의 성장은 빨라요.'),
('ja',7,'約束','약속','友だちとの約束を守ります。','친구와의 약속을 지켜요.'),
('ja',8,'可能性','가능성','成功する可能性があります。','성공할 가능성이 있어요.'),
('ja',9,'努力','노력','彼は毎日努力しています。','그는 매일 노력하고 있어요.'),
('ja',10,'発見','발견','散歩の途中で新しい店を発見しました。','산책하던 중 새로운 가게를 발견했어요.'),
('ja',11,'感謝','감사','助けてくれた友だちに感謝します。','도와준 친구에게 감사해요.'),
('ja',12,'準備','준비','旅行の準備をしています。','여행을 준비하고 있어요.'),
('ja',13,'理解','이해','説明を聞いて理解できました。','설명을 듣고 이해할 수 있었어요.'),
('ja',14,'集中','집중','静かな部屋で勉強に集中します。','조용한 방에서 공부에 집중해요.'),
('ja',15,'希望','희망','将来に希望を持っています。','미래에 대한 희망을 품고 있어요.'),
('ja',16,'勇気','용기','勇気を出して質問しました。','용기를 내서 질문했어요.'),
('zh',1,'学习','배우다, 학습하다','我每天学习中文。','저는 매일 중국어를 공부해요.'),
('zh',2,'经验','경험','这次旅行给了我很多经验。','이번 여행은 저에게 많은 경험을 주었어요.'),
('zh',3,'习惯','습관','我有每天读书的习惯。','저는 매일 책을 읽는 습관이 있어요.'),
('zh',4,'挑战','도전','这是一个新的挑战。','이것은 새로운 도전이에요.'),
('zh',5,'信心','자신감, 믿음','练习让我更有信心。','연습을 하면 자신감이 더 생겨요.'),
('zh',6,'成长','성장하다','孩子们在快乐中成长。','아이들은 즐거움 속에서 성장해요.'),
('zh',7,'机会','기회','我不想错过这个机会。','저는 이 기회를 놓치고 싶지 않아요.'),
('zh',8,'坚持','꾸준히 계속하다, 견지하다','我坚持每天练习。','저는 매일 꾸준히 연습해요.'),
('zh',9,'努力','노력하다','他正在努力学习。','그는 열심히 공부하고 있어요.'),
('zh',10,'发现','발견하다','我发现了一家新书店。','저는 새 서점을 발견했어요.'),
('zh',11,'感谢','감사하다','感谢你的帮助。','도와줘서 고마워요.'),
('zh',12,'准备','준비하다','我们正在准备晚饭。','우리는 저녁 식사를 준비하고 있어요.'),
('zh',13,'理解','이해하다','我理解你的想法。','저는 당신의 생각을 이해해요.'),
('zh',14,'专注','집중하다','她专注于自己的工作。','그녀는 자신의 일에 집중해요.'),
('zh',15,'希望','희망하다, 바라다','我希望明天是个晴天。','저는 내일 날씨가 맑기를 바라요.'),
('zh',16,'勇气','용기','她有勇气面对困难。','그녀는 어려움에 맞설 용기가 있어요.'),
('ko',1,'성취','목적한 일을 이룸','작은 목표를 이루며 성취를 느껴요.','작은 목표를 이루며 성취를 느껴요.'),
('ko',2,'통찰','사물의 본질을 꿰뚫어 보는 이해','그 책은 삶에 대한 통찰을 담고 있어요.','그 책은 삶에 대한 통찰을 담고 있어요.'),
('ko',3,'끈기','쉽게 포기하지 않고 이어가는 성질','그는 끈기 있게 문제를 풀었어요.','그는 끈기 있게 문제를 풀었어요.'),
('ko',4,'배려','상대방을 생각하여 도와주거나 보살피는 마음','작은 배려가 큰 힘이 될 수 있어요.','작은 배려가 큰 힘이 될 수 있어요.'),
('ko',5,'호기심','새롭거나 모르는 것을 알고 싶어 하는 마음','아이의 호기심이 새로운 질문을 만들어요.','아이의 호기심이 새로운 질문을 만들어요.'),
('ko',6,'관점','사물을 보고 생각하는 입장','다른 관점에서 문제를 바라봐요.','다른 관점에서 문제를 바라봐요.'),
('ko',7,'도전','어려운 일에 맞서거나 새로운 일을 시도함','새로운 언어를 배우는 일은 즐거운 도전이에요.','새로운 언어를 배우는 일은 즐거운 도전이에요.'),
('ko',8,'균형','어느 한쪽으로 치우치지 않은 상태','일과 휴식의 균형을 지켜요.','일과 휴식의 균형을 지켜요.'),
('ko',9,'인내','어려움을 참고 견딤','긴 연습에는 인내가 필요해요.','긴 연습에는 인내가 필요해요.'),
('ko',10,'지혜','사리를 바르게 판단하고 잘 처리하는 능력','경험을 통해 지혜를 얻어요.','경험을 통해 지혜를 얻어요.'),
('ko',11,'용기','두려움을 무릅쓰고 나아가는 마음','용기를 내어 의견을 말했어요.','용기를 내어 의견을 말했어요.'),
('ko',12,'협력','힘을 합하여 서로 도움','서로 협력하면 더 멀리 갈 수 있어요.','서로 협력하면 더 멀리 갈 수 있어요.'),
('ko',13,'여유','급하지 않고 넉넉한 상태','잠시 산책하며 마음의 여유를 찾아요.','잠시 산책하며 마음의 여유를 찾아요.'),
('ko',14,'책임','맡아서 해야 할 의무나 임무','자신이 맡은 일에 책임을 다해요.','자신이 맡은 일에 책임을 다해요.'),
('ko',15,'공감','다른 사람의 감정이나 생각을 함께 느낌','친구의 이야기에 깊이 공감했어요.','친구의 이야기에 깊이 공감했어요.'),
('ko',16,'가능성','앞으로 실현될 수 있는 성질','누구에게나 성장할 가능성이 있어요.','누구에게나 성장할 가능성이 있어요.');

DO $$
DECLARE target_id BIGINT; item RECORD; entry RECORD; changed INTEGER := 0;
BEGIN
  SELECT id INTO target_id FROM users WHERE email='jishuya3015@naver.com' FOR UPDATE;
  IF target_id IS NULL THEN RAISE EXCEPTION '대상 계정을 찾지 못했습니다.'; END IF;
  FOR item IN
    SELECT v.id,v.word,v.language_code,CASE WHEN v.word LIKE 'graph-extra-v1-%' THEN substring(v.word FROM '([0-7])$')::integer ELSE (substring(v.word FROM '([0-9]{3})$')::integer-1)%8 END AS original_level
    FROM vocabularies v
    WHERE v.user_id=target_id AND ((v.word ~ '^graph-extra-v1-(en|fr|ja|zh|ko)-[0-7]$'
      AND EXISTS(SELECT 1 FROM xp_events x WHERE x.user_id=target_id
        AND x.metadata->>'seed'='graph-extra-v1' AND x.metadata->>'purpose'='fixture-manifest'
        AND x.metadata->'vocabulary_ids' @> to_jsonb(ARRAY[v.id])))
      OR (v.word ~ '^graph-preview-[0-9]{3}$' AND v.language_code='en' AND v.meaning='그래프 테스트 어휘 '||substring(v.word FROM '([0-9]{3})$')::integer))
    ORDER BY v.id
  LOOP
    SELECT d.* INTO entry FROM graph_real_dictionary d
    WHERE d.language=item.language_code AND NOT EXISTS(
      SELECT 1 FROM vocabularies v WHERE v.user_id=target_id AND v.language_code=d.language AND lower(v.word)=lower(d.word) AND v.id<>item.id
    ) ORDER BY CASE WHEN d.ordinal=item.original_level+1 THEN 0 WHEN d.ordinal>8 THEN 1 ELSE 2 END,d.ordinal LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION '% 언어에 중복되지 않는 실제 단어가 부족합니다.',item.language_code; END IF;
    UPDATE vocabularies SET word=entry.word,meaning=entry.meaning,context_meaning=entry.meaning,
      cefr_level=NULL,example_sentence=entry.example,example_translation=entry.translation,
      memory_tip=NULL,etymology=NULL WHERE id=item.id;
    -- 예시 세션의 문제 내용도 실제 뜻으로 교체합니다. 정오답 결과는 바꾸지 않습니다.
    UPDATE quiz_session_items i SET prompt=entry.word||'의 뜻을 떠올려보세요.',correct_answer=entry.meaning,
      choices=jsonb_build_array(entry.meaning,'다른 뜻')
    WHERE i.vocabulary_id=item.id AND EXISTS(SELECT 1 FROM quiz_sessions s WHERE s.id=i.session_id AND s.user_id=target_id);
    changed := changed+1;
  END LOOP;
  -- 같은 예시 배치에서 만든 스토리의 단어/언어도 실제 어휘와 맞춥니다.
  UPDATE ai_stories s SET used_words=ARRAY[v.word],
    english_content=v.example_sentence||' '||CASE v.language_code
      WHEN 'en' THEN 'I learned a new word today. I will practice it again tomorrow.'
      WHEN 'fr' THEN 'J’apprends un mot aujourd’hui. Je vais le réviser demain.'
      WHEN 'ja' THEN '今日は新しい言葉を学びます。明日もう一度練習します。'
      WHEN 'zh' THEN '今天我学习一个新词。明天我会再次练习。'
      ELSE '오늘 새 단어를 배워요. 내일 다시 복습할 거예요.' END,
    korean_translation=v.example_translation||' 오늘 새 단어를 배워요. 내일 다시 복습할 거예요.'
  FROM vocabularies v
  WHERE s.user_id=target_id AND v.user_id=target_id AND v.id=s.vocabulary_ids[1]
    AND EXISTS(SELECT 1 FROM xp_events x WHERE x.user_id=target_id AND x.metadata->>'seed'='graph-extra-v1'
      AND x.metadata->>'purpose'='fixture-manifest' AND x.metadata->'story_ids' @> to_jsonb(ARRAY[s.id]));
  IF changed>0 AND NOT EXISTS(SELECT 1 FROM xp_events WHERE user_id=target_id AND metadata->>'seed'='graph-preview-real-v1') THEN
    INSERT INTO xp_events(user_id,event_type,amount,metadata) VALUES(target_id,'bonus',0,'{"seed":"graph-preview-real-v1","purpose":"repaired-fixtures"}');
  END IF;
  RAISE NOTICE '실제 단어로 교체한 개수: % (0이면 이미 교체되었거나 대상 예시가 없습니다)',changed;
END $$;
COMMIT;
