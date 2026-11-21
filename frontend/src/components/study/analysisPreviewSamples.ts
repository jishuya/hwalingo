import type { AnalyzedSentence, SentenceAnalysis, SentenceParaphrase, VocabularyAnalysis } from '../../services/analysis'

function sentence(
  text: string,
  koreanTranslation: string,
  englishTranslation: string,
  chunks: [string, string][],
  paraphrases: [string, string, string, string],
  vocabulary: VocabularyAnalysis,
): AnalyzedSentence {
  const levels: SentenceParaphrase['level'][] = ['B1', 'B2', 'C1', 'C2']
  return {
    inputText: text,
    learningSentence: text,
    koreanTranslation,
    englishTranslation,
    keyExpressions: [{ text: vocabulary.word, meaning: vocabulary.contextualMeaning }],
    chunks: chunks.map(([targetText, sourceMeaning]) => ({ targetText, sourceMeaning })),
    paraphrases: paraphrases.map((targetText, index) => ({ level: levels[index], targetText, sourceMeaning: koreanTranslation })),
    vocabulary: [vocabulary],
  }
}

export const analysisPreviewSamples: SentenceAnalysis[] = [
  {
    inputLanguage: 'en',
    learningLanguage: 'en',
    detectedSourceLanguage: 'en',
    backgroundKnowledge: '대학 도서관이 늦게까지 문을 열었을 때 학생들의 공부 환경이 어떻게 달라졌는지 평가하는 글이에요. 공간을 마련하는 것과 학생들이 그 공간을 실제로 이용할 수 있게 하는 것의 차이를 짚어요.',
    warnings: [],
    sentences: [
      sentence(
        'When the university extended its library hours, students with evening jobs finally had a quiet place to study.',
        '대학이 도서관 운영 시간을 늘리자 저녁에 일하는 학생들도 마침내 조용히 공부할 곳이 생겼어요.',
        'When the university extended its library hours, students with evening jobs finally had a quiet place to study.',
        [['When', '~했을 때'], ['the university', '대학이'], ['extended', '늘렸다'], ['its library hours,', '도서관 운영 시간을'], ['students', '학생들은'], ['with evening jobs', '저녁에 일하는'], ['finally', '마침내'], ['had', '갖게 되었다'], ['a quiet place', '조용한 장소를'], ['to study.', '공부할 수 있는']],
        ['The university kept its library open longer, so students who worked in the evenings finally had a quiet place to study.', 'By extending library hours, the university gave students with evening jobs a quiet place to study at last.', 'The extension of library hours finally gave students working evenings access to a quiet study space.', 'Only after the university lengthened its library hours did students with evening jobs gain access to a quiet place to study.'],
        { word: 'extend', partOfSpeech: '동사', level: 'B2', basicMeaning: '연장하다', contextualMeaning: '문을 열어 두는 시간을 늘리다', etymology: '라틴어에서 바깥쪽으로 뻗는다는 뜻에서 비롯됐어요.', memoryTip: '마감이나 운영 시간을 뒤로 늘리는 장면을 떠올려 보세요.', exampleSentence: 'Could you extend the deadline by two days?', exampleMeaning: '마감일을 이틀 연장해 주실 수 있나요?' },
      ),
      sentence(
        'Yet the change did little for those who relied on buses that stopped running before the library closed.',
        '하지만 도서관이 문을 닫기 전에 운행이 끝나는 버스에 의존하는 학생들에게는 그 변화가 별 도움이 되지 않았어요.',
        'Yet the change did little for those who relied on buses that stopped running before the library closed.',
        [['Yet', '하지만'], ['the change', '그 변화는'], ['did little', '별 도움이 되지 않았다'], ['for those', '그 사람들에게'], ['who relied', '의존하는'], ['on buses', '버스에'], ['that stopped running', '운행을 멈추는'], ['before', '~하기 전에'], ['the library', '도서관이'], ['closed.', '문을 닫았다']],
        ['But the change did not help much if students needed to catch a bus that stopped running before the library closed.', 'However, the longer hours made little difference to students whose bus service ended before closing time.', 'The extended hours offered scant benefit to students dependent on bus routes that ceased operating before the library closed.', 'For those whose ability to stay depended on bus services ending before closing time, the reform brought little practical benefit.'],
        { word: 'rely on', partOfSpeech: '동사구', level: 'B2', basicMeaning: '의존하다', contextualMeaning: '이동하려면 버스를 이용해야 하다', etymology: '기대거나 의지한다는 뜻에서 신뢰하고 의존한다는 뜻으로 이어졌어요.', memoryTip: '다른 수단 없이 그것에 기대는 상황에 쓰는 표현이에요.', exampleSentence: 'Many small farms rely on rainwater.', exampleMeaning: '많은 소규모 농장은 빗물에 의존해요.' },
      ),
      sentence(
        'The experience suggests that improving access requires more than keeping a building open.',
        '이 경험은 접근성을 높이려면 건물을 열어 두는 것 이상의 노력이 필요하다는 점을 보여 줘요.',
        'The experience suggests that improving access requires more than keeping a building open.',
        [['The experience', '그 경험은'], ['suggests', '시사한다'], ['that', '~라는 점을'], ['improving access', '접근성을 개선하려면'], ['requires', '필요하다'], ['more than', '~이상의 것이'], ['keeping', '유지하는 것'], ['a building', '건물을'], ['open.', '열린 상태로']],
        ['This shows that keeping a building open is not enough to make it easier to use.', 'The experience suggests that longer opening hours alone are not enough to improve access.', 'The experience indicates that genuine improvements in access depend on more than the availability of a building.', 'What the experience brings into focus is the gap between keeping a facility open and making it genuinely accessible.'],
        { word: 'access', partOfSpeech: '명사', level: 'B1', basicMeaning: '접근', contextualMeaning: '필요할 때 실제로 도서관을 이용할 수 있는 여건', etymology: '다가간다는 뜻의 라틴어에서 유래했어요.', memoryTip: '문이 열려 있어도 그곳까지 갈 수 있어야 접근이 가능하다고 생각해 보세요.', exampleSentence: 'The scholarship improves access to higher education.', exampleMeaning: '그 장학금은 고등 교육을 받을 기회를 넓혀 줘요.' },
      ),
    ],
  },
  {
    inputLanguage: 'fr',
    learningLanguage: 'fr',
    detectedSourceLanguage: 'fr',
    backgroundKnowledge: '도심 자동차 통행을 줄이는 정책을 두고 환경상의 이익과 이동의 형평성을 함께 검토하는 글이에요. 교외 주민에게 충분한 대체 교통수단이 있는지도 정책 평가의 기준으로 삼아요.',
    warnings: [],
    sentences: [
      sentence(
        'La réduction de la circulation automobile en centre-ville peut améliorer la qualité de l’air.',
        '도심의 자동차 통행을 줄이면 공기 질을 개선할 수 있어요.',
        'Reducing car traffic in the city center can improve air quality.',
        [['La réduction', '감소는'], ['de la circulation', '통행의'], ['automobile', '자동차'], ['en centre-ville', '도심에서'], ['peut', '~할 수 있다'], ['améliorer', '개선하다'], ['la qualité', '질을'], ['de l’air.', '공기의']],
        ['Si moins de voitures circulent dans le centre-ville, l’air peut devenir plus propre.', 'Limiter le trafic automobile dans le centre-ville peut rendre l’air plus sain.', 'La diminution du trafic routier dans le centre urbain est susceptible d’améliorer la qualité de l’air.', 'Un recul de la circulation automobile au cœur de la ville pourrait se traduire par une amélioration de la qualité de l’air.'],
        { word: 'réduction', partOfSpeech: '여성 명사', level: 'B1', basicMeaning: '감소', contextualMeaning: '도심에 다니는 자동차의 통행량을 줄이는 것', etymology: '프랑스어로 줄인다는 뜻의 동사와 같은 어근이에요.', memoryTip: '기존 규모에서 한 부분을 덜어 내는 상황을 떠올려 보세요.', exampleSentence: 'La réduction du bruit a facilité la concentration.', exampleMeaning: '소음이 줄어 집중하기 쉬워졌어요.' },
      ),
      sentence(
        'Toutefois, une telle mesure risque de pénaliser les habitants des communes voisines si les transports en commun restent insuffisants.',
        '다만 대중교통이 여전히 부족하다면 이런 조치는 인근 지자체 주민들에게 불이익을 줄 수 있어요.',
        'However, such a measure may disadvantage residents of neighboring municipalities if public transport remains insufficient.',
        [['Toutefois,', '다만'], ['une telle mesure', '이런 조치는'], ['risque', '~할 우려가 있다'], ['de pénaliser', '불이익을 주다'], ['les habitants', '주민들에게'], ['des communes', '지자체의'], ['voisines', '인근'], ['si', '~한다면'], ['les transports en commun', '대중교통이'], ['restent', '여전히 ~이다'], ['insuffisants.', '부족한']],
        ['Mais cette décision peut gêner les habitants des villes voisines si les bus et les trains ne suffisent pas.', 'Cette mesure pourrait désavantager les habitants des communes proches si l’offre de transports publics reste trop limitée.', 'Faute de transports collectifs suffisants, une telle mesure risque de compliquer les déplacements des habitants des communes voisines.', 'À défaut d’une offre de transports collectifs à la hauteur des besoins, ce dispositif pourrait pénaliser les résidents des communes limitrophes.'],
        { word: 'pénaliser', partOfSpeech: '동사', level: 'B2', basicMeaning: '불이익을 주다', contextualMeaning: '대체 교통수단이 적은 주민들의 이동을 어렵게 하다', etymology: '처벌이나 벌과 관련된 말에서 비롯되어 불리하게 만든다는 뜻으로도 쓰여요.', memoryTip: '규칙 때문에 누구에게 부담이 더 커졌는지 생각해 보세요.', exampleSentence: 'Ce retard risque de pénaliser toute l’équipe.', exampleMeaning: '이 지연으로 팀 전체가 불이익을 받을 수 있어요.' },
      ),
      sentence(
        'Pour évaluer cette politique, il faut donc tenir compte à la fois des effets environnementaux et des besoins de déplacement.',
        '따라서 이 정책을 평가하려면 환경에 미치는 영향과 이동 수요를 함께 고려해야 해요.',
        'To evaluate this policy, we must therefore take into account both its environmental effects and travel needs.',
        [['Pour évaluer', '평가하려면'], ['cette politique,', '이 정책을'], ['il faut', '~해야 한다'], ['donc', '따라서'], ['tenir compte', '고려하다'], ['à la fois', '동시에'], ['des effets', '영향을'], ['environnementaux', '환경에 미치는'], ['et', '그리고'], ['des besoins', '수요를'], ['de déplacement.', '이동의']],
        ['Pour juger cette politique, il faut donc regarder ses effets sur l’environnement et les besoins des personnes qui se déplacent.', 'L’évaluation de cette politique doit donc prendre en compte ses effets sur l’environnement ainsi que les besoins de mobilité.', 'Il convient donc d’apprécier cette politique au regard de ses effets sur l’environnement et des besoins de mobilité.', 'Une évaluation rigoureuse de cette politique suppose dès lors de considérer conjointement ses effets environnementaux et les besoins de déplacement.'],
        { word: 'tenir compte de', partOfSpeech: '동사구', level: 'B2', basicMeaning: '고려하다', contextualMeaning: '정책을 평가할 때 환경과 주민의 이동 수요를 살피다', etymology: '계산이나 셈을 뜻하는 명사가 들어 있어 어떤 요소를 판단에 넣는다는 뜻이에요.', memoryTip: '결정을 내리기 전 빠뜨리면 안 되는 조건에 쓰는 표현이에요.', exampleSentence: 'Le jury doit tenir compte de l’expérience des candidats.', exampleMeaning: '심사위원단은 지원자들의 경험을 고려해야 해요.' },
      ),
    ],
  },
]
