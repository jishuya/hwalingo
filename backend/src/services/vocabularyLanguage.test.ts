import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { isExampleInLearningLanguage, isVocabularyInLearningLanguage, VocabularyLanguageError } from './vocabularyLanguage.js'
import type { VocabularyAnalysis } from './openai.js'

const examples = [
  { language: 'en', word: 'resilience', sentence: 'Her resilience helped her recover.' },
  { language: 'fr', word: 'timidité', sentence: 'Sa timidité disparaît avec ses amis.' },
  { language: 'de', word: 'Ausdauer', sentence: 'Ihre Ausdauer hilft ihr beim Lernen.' },
  { language: 'es', word: 'perseverancia', sentence: 'Su perseverancia le ayuda a aprender.' },
  { language: 'zh', word: '珍藏', sentence: '这是她的珍藏。' },
  { language: 'ja', word: '挑戦', sentence: '彼は新しいことに挑戦する。' },
  { language: 'ko', word: '인내심', sentence: '그는 인내심을 가지고 기다렸어요.' },
] as const

test('whole examples reject foreign prose with a target word in all seven languages', () => {
  for (const fixture of examples) {
    assert.equal(isExampleInLearningLanguage(fixture.sentence, fixture.language), true)
    const wrong = fixture.language === 'ko'
      ? `She shows ${fixture.word} every day.` : `새로 온 고양이는 ${fixture.word}를 보이며 숨었어요.`
    assert.equal(isExampleInLearningLanguage(wrong, fixture.language), false, fixture.language)
    assert.equal(isExampleInLearningLanguage('', fixture.language), false)
  }
  assert.equal(isExampleInLearningLanguage('这是一个trove。', 'zh'), false)
  assert.equal(isExampleInLearningLanguage('これはchallengeです。', 'ja'), false)
})

test('all 49 input/learning pairs retry mixed examples and reject repeated failures', async () => {
  process.env.JWT_SECRET = 'vocabulary-language-test'
  process.env.OPENAI_API_KEY = 'vocabulary-language-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateSentenceVocabulary } = await import('./openai.js')
  for (const fixture of examples) {
    for (const source of examples) {
      const good: VocabularyAnalysis = { word: fixture.word, pronunciation: '', level: 'B2', partOfSpeech: '명사',
        basicMeaning: '참고 견딤', contextualMeaning: '어려움을 참고 견딤', etymology: '',
        memoryTip: '힘든 길을 끝까지 걸어가는 모습을 떠올려요.',
        exampleSentence: fixture.sentence, exampleMeaning: '그는 어려움을 참고 견뎠어요.' }
      const broken = { ...good, exampleSentence: fixture.language === 'ko'
        ? `She shows ${fixture.word} every day.` : `그는 ${fixture.word}를 보여 주었어요.` }
      for (const alwaysInvalid of [false, true]) {
        let calls = 0
        const method = mock.method(getOpenAIClient().responses, 'create', async () => ({
          output_text: JSON.stringify({ sentences: [{ sentenceIndex: 0, vocabulary: [++calls === 1 || alwaysInvalid ? broken : good] }] }),
        }))
        const input = { text: source.sentence, inputLanguage: source.language, learningLanguage: fixture.language,
          sentences: [{ inputText: source.sentence, learningSentence: fixture.sentence }] }
        try {
          if (alwaysInvalid) await assert.rejects(generateSentenceVocabulary(input), VocabularyLanguageError)
          else assert.deepEqual(await generateSentenceVocabulary(input), [[good]])
          assert.equal(calls, 2)
        } finally { method.mock.restore() }
      }
    }
  }
})

test('Chinese vocabulary rejects English words even in a Chinese example', () => {
  const sentence = '图书馆发现了一个珍藏。'
  assert.equal(isVocabularyInLearningLanguage({ word: 'trove', exampleSentence: '图书馆发现了一个trove。' }, sentence, 'zh'), false)
  assert.equal(isVocabularyInLearningLanguage({ word: '珍藏', exampleSentence: '这是她的珍藏。' }, sentence, 'zh'), true)
  assert.equal(isVocabularyInLearningLanguage({ word: '收复', exampleSentence: '他们收复了城市。' }, sentence, 'zh'), false)
})

test('English to Chinese sends only the learning sentence and retries wrong-language vocabulary once', async () => {
  process.env.JWT_SECRET = 'vocabulary-language-test'
  process.env.OPENAI_API_KEY = 'vocabulary-language-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateSentenceVocabulary } = await import('./openai.js')
  const good: VocabularyAnalysis = {
    word: '珍藏', pronunciation: 'zhēn cáng', level: 'B2', partOfSpeech: '명사',
    basicMeaning: '귀중한 소장품', contextualMeaning: '귀중하게 간직한 소장품',
    etymology: '귀중하게 간직한다는 뜻의 말이에요.', memoryTip: '진귀한 보물을 창고에 넣는 장면을 떠올려요.',
    exampleSentence: '这是她的珍藏。', exampleMeaning: '이것은 그녀의 귀중한 소장품이에요.',
  }
  const input = { text: 'The library found a trove.', inputLanguage: 'en' as const, learningLanguage: 'zh' as const,
    sentences: [{ inputText: 'The library found a trove.', learningSentence: '图书馆发现了一个珍藏。' }] }
  for (const alwaysInvalid of [false, true]) {
    let calls = 0
    const method = mock.method(getOpenAIClient().responses, 'create', async (request: { input: string }) => {
      assert.deepEqual(JSON.parse(request.input).sentences, [{ sentenceIndex: 0, learningSentence: input.sentences[0].learningSentence }])
      const item = ++calls === 1 || alwaysInvalid ? { ...good, word: 'trove', exampleSentence: '这是一个trove。' } : good
      return { output_text: JSON.stringify({ sentences: [{ sentenceIndex: 0, vocabulary: [item] }] }) }
    })
    try {
      if (alwaysInvalid) await assert.rejects(generateSentenceVocabulary(input), VocabularyLanguageError)
      else assert.deepEqual(await generateSentenceVocabulary(input), [[good]])
      assert.equal(calls, 2)
    } finally { method.mock.restore() }
  }
})
