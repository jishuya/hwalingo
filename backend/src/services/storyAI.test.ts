import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { isKoreanStoryTranslation } from './storyTranslationValidation.js'

test('story translations reject source text and mixed Chinese/Japanese prose', () => {
  for (const value of [null, '', '我在公园散步。', '公園を散歩します。', 'I walk in the park.', '나는 公园에서 산책해요.']) {
    assert.equal(isKoreanStoryTranslation(value), false)
  }
  assert.equal(isKoreanStoryTranslation('나는 공원에서 산책하다가 커피를 사기로 했어요.'), true)
})

test('story translation retries foreign-language output once and rejects repeated failures', async () => {
  process.env.JWT_SECRET = 'story-translation-test'
  process.env.OPENAI_API_KEY = 'story-translation-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateStoryTranslation } = await import('./storyAI.js')
  const client = getOpenAIClient()
  const source = '我在公园散步。'
  const korean = '나는 공원에서 산책해요.'
  try {
    let calls = 0
    const method = mock.method(client.responses, 'create', async (input: { input: string; instructions: string }) => {
      calls++
      assert.equal(JSON.parse(input.input).outputLanguage, 'Korean (ko)')
      assert.ok(input.instructions.includes('Korean Hangul'))
      return { output_text: JSON.stringify({ translation: calls === 1 ? source : korean }) }
    })
    assert.equal(await generateStoryTranslation({ story: source, languageCode: 'zh' }), korean)
    assert.equal(calls, 2)
    method.mock.restore()
    calls = 0
    const failure = mock.method(client.responses, 'create', async () => {
      calls++
      return { output_text: JSON.stringify({ translation: source }) }
    })
    await assert.rejects(generateStoryTranslation({ story: source, languageCode: 'zh' }), /한국어 번역을 생성하지 못했어요/)
    assert.equal(calls, 2)
    failure.mock.restore()
    calls = 0
    mock.method(client.responses, 'create', async () => {
      calls++
      return { output_text: JSON.stringify({ translation: korean }) }
    })
    assert.equal(await generateStoryTranslation({ story: source, languageCode: 'zh' }), korean)
    assert.equal(calls, 1)
  } finally {
    mock.restoreAll()
  }
})

test('generated stories include pronunciation alongside the used vocabulary', async () => {
  process.env.JWT_SECRET = 'story-translation-test'
  process.env.OPENAI_API_KEY = 'story-translation-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateStory } = await import('./storyAI.js')
  try {
    mock.method(getOpenAIClient().responses, 'create', async () => ({ output_text: JSON.stringify({
      title: '周末', sentences: ['我决定去公园。', '天气很好。', '我很快乐。'],
      vocabularyUsages: [{ vocabularyId: '1', usedForm: '决定', pronunciation: 'juédìng' }],
    }) }))
    const story = await generateStory({ vocabularies: [{ vocabularyId: '1', word: '决定', meaning: '결정하다', contextMeaning: null, cefrLevel: 'B1' }],
      languageCode: 'zh', genre: 'daily', length: 'short', difficulty: 'easy' })
    assert.equal(story.vocabularyUsages[0].pronunciation, 'juédìng')
    assert.equal(story.vocabularyUsages[0].word, '决定')
    assert.equal(story.vocabularyUsages[0].meaning, '결정하다')
    assert.equal(story.segments.map(segment => segment.text).join(''), story.story)
  } finally {
    mock.restoreAll()
  }
})
