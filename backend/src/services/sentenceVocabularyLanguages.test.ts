import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { buildVocabularyInstructions } from './sentenceVocabularyPrompts.js'
import type { LanguageCode, VocabularyAnalysis } from './openai.js'

const fixtures = [
  { language: 'en', word: 'resilience', pronunciation: '/rɪˈzɪliəns/', sentence: 'Her resilience helped her recover.', foreign: '회복 능력: the ability to recover' },
  { language: 'fr', word: 'résilience', pronunciation: '/ʁe.zil.jɑ̃s/', sentence: 'Sa résilience lui permet de rebondir.', foreign: '회복 능력: la capacité à rebondir' },
  { language: 'ja', word: '奪還', pronunciation: 'だっかん', sentence: 'チームは首位の奪還を目指す。', foreign: '다시: 失ったものを取り戻すこと' },
  { language: 'zh', word: '收复', pronunciation: 'shōu fù', sentence: '球队希望收复榜首位置。', foreign: '다시: 重新夺回失去的东西' },
  { language: 'ko', word: '탈환', pronunciation: '[탈환]', sentence: '우리 팀은 선두 탈환을 노린다.', foreign: '되찾음: recovering a lost position' },
] as const

test('all learning languages correct mixed explanations, preserve good fields, and reject failed repairs', async () => {
  process.env.JWT_SECRET = 'language-contract-test'
  process.env.OPENAI_API_KEY = 'language-contract-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateSentenceVocabulary } = await import('./openai.js')
  const client = getOpenAIClient()
  const fields = ['partOfSpeech', 'basicMeaning', 'contextualMeaning', 'exampleMeaning', 'memoryTip', 'etymology'] as const
  const output = (item: VocabularyAnalysis) => ({ output_text: JSON.stringify({ sentences: [{ sentenceIndex: 0, vocabulary: [item] }] }) })

  for (const fixture of fixtures) {
    const good: VocabularyAnalysis = { word: fixture.word, pronunciation: fixture.pronunciation, level: 'B2',
      partOfSpeech: '명사', basicMeaning: '다시 회복함', contextualMeaning: '잃었던 상태를 되찾음',
      etymology: "'원형'에서 유래했어요.", memoryTip: `'${fixture.word}'를 보며 다시 벌떡 일어서는 모습을 떠올려요.`,
      exampleSentence: fixture.sentence, exampleMeaning: '그는 다시 회복할 수 있었어요.' }
    const request = { text: fixture.sentence, inputLanguage: fixture.language as LanguageCode,
      learningLanguage: fixture.language as LanguageCode, sentences: [{ inputText: fixture.sentence, learningSentence: fixture.sentence }] }
    for (const field of fields) {
      const broken = { ...good, [field]: fixture.foreign }
      let calls = 0
      const repair = mock.method(client.responses, 'create', async () => output(++calls === 1 ? broken : good))
      try {
        const result = await generateSentenceVocabulary(request)
        assert.equal(calls, 2, `${fixture.language}/${field}`)
        assert.deepEqual(result[0][0], good)
      } finally { repair.mock.restore() }
    }
    const broken = { ...good, contextualMeaning: fixture.foreign, memoryTip: '' }
    const failed = mock.method(client.responses, 'create', async () => output(broken))
    try {
      await assert.rejects(generateSentenceVocabulary(request), /한국어 설명을 완성하지 못했어요/)
    } finally { failed.mock.restore() }

    let outageCalls = 0
    const outage = mock.method(client.responses, 'create', async () => {
      if (++outageCalls === 1) return output(broken)
      throw new Error('mock correction unavailable')
    })
    try {
      await assert.rejects(generateSentenceVocabulary(request), /한국어 설명을 완성하지 못했어요/)
    } finally { outage.mock.restore() }

    // Correction must not erase already valid information while fixing another field.
    let calls = 0
    const preserves = mock.method(client.responses, 'create', async () => output(++calls === 1
      ? { ...good, contextualMeaning: fixture.foreign }
      : { ...good, etymology: '', memoryTip: '', basicMeaning: fixture.foreign }))
    try {
      const result = await generateSentenceVocabulary(request)
      assert.deepEqual(result[0][0], good)
    } finally { preserves.mock.restore() }

    const valid = mock.method(client.responses, 'create', async () => output(good))
    try {
      for (const { language: inputLanguage } of fixtures) {
        assert.deepEqual((await generateSentenceVocabulary({ ...request, inputLanguage }))[0][0], good)
      }
      assert.equal(valid.mock.callCount(), 5)
    } finally { valid.mock.restore() }
  }
})

test('prompts use the same language contract for creation and correction with only the selected pronunciation rule', () => {
  for (const { language } of fixtures) {
    for (const correction of [false, true]) {
      const prompt = buildVocabularyInstructions(language, correction)
      assert.match(prompt, /Korean only/)
      assert.match(prompt, /memoryTip: required/)
      assert.match(prompt, /etymology: one factual Korean sentence/)
      assert.match(prompt, new RegExp(`learningLanguage=${language}:`))
      assert.doesNotMatch(prompt, /Assign a grammatical role|same-role|subject relative/)
    }
  }
})

test('actual sentence-analysis requests contain no grammatical role classification for any language', async () => {
  process.env.JWT_SECRET = 'language-contract-test'
  process.env.OPENAI_API_KEY = 'language-contract-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { analyzeSentence } = await import('./openai.js')
  const client = getOpenAIClient()
  for (const fixture of fixtures) {
    const method = mock.method(client.responses, 'create', async (request: { instructions: string; text: unknown }) => {
      assert.doesNotMatch(request.instructions, /Assign a grammatical role|same-role|subject relative|grammarInstructions/)
      const schema = JSON.stringify(request.text)
      assert.doesNotMatch(schema, /"role"|"subject"|"verb"/)
      return { output_text: JSON.stringify({ inputLanguage: fixture.language, learningLanguage: fixture.language,
        detectedSourceLanguage: fixture.language, backgroundKnowledge: '다시 도전하는 상황이에요.', warnings: [],
        sentences: [{ inputText: fixture.sentence, learningSentence: fixture.sentence,
          koreanTranslation: '다시 도전해요.', englishTranslation: 'Try again.', keyExpressions: [],
          chunks: [{ targetText: fixture.sentence, sourceMeaning: '다시 도전해요.' }] }] }) }
    })
    try {
      const result = await analyzeSentence({ text: fixture.sentence, inputLanguage: fixture.language, learningLanguage: fixture.language })
      assert.equal(result.sentences[0].learningSentence, fixture.sentence)
      assert.equal(method.mock.callCount(), 1)
    } finally { method.mock.restore() }
  }
})
