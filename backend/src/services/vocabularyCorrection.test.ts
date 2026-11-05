import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

test('vocabulary generation corrects readings and etymology and hides failed corrections', async () => {
  process.env.JWT_SECRET = 'vocabulary-correction-test'
  process.env.OPENAI_API_KEY = 'vocabulary-correction-test'
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateSentenceVocabulary } = await import('./openai.js')
  const client = getOpenAIClient()
  const item = {
    word: '挑戦します', pronunciation: '/tɕoːseɴɕimasɯ/', partOfSpeech: '동사', level: 'B1',
    basicMeaning: '도전하다', contextualMeaning: '새로운 일에 도전하다',
    etymology: '두 한자가 합쳐진 말이다.', memoryTip: '새로운 일에 도전하는 모습을 떠올려요.',
    exampleSentence: '彼は難しいパズルに挑戦します。', exampleMeaning: '그는 어려운 퍼즐에 도전해요.',
  }
  const output = (vocabulary: typeof item) => ({ output_text: JSON.stringify({ sentences: [{ sentenceIndex: 0, vocabulary: [vocabulary] }] }) })
  try {
    for (const learningLanguage of ['ja', 'en', 'fr', 'zh', 'ko'] as const) {
      let calls = 0
      const method = mock.method(client.responses, 'create', async () => {
        calls++
        return output(calls === 1 ? item : {
          ...item, pronunciation: 'ちょうせんします', etymology: '두 한자가 합쳐진 말이에요.',
        })
      })
      const result = await generateSentenceVocabulary({ text: '도전해요.', inputLanguage: 'ko', learningLanguage,
        sentences: [{ inputText: '도전해요.', learningSentence: item.exampleSentence }] })
      assert.equal(calls, 2)
      assert.equal(result[0][0].etymology, '두 한자가 합쳐진 말이에요.')
      assert.equal(result[0][0].pronunciation, learningLanguage === 'ja' ? 'ちょうせんします' : item.pronunciation)
      method.mock.restore()
    }
    // The reported mixed Korean/Japanese context used to pass the Hangul-only check.
    const mixed = { ...item, pronunciation: 'ちょうせんします',
      contextualMeaning: '임기 말に公職자の権限や影響力が急激に減る状況',
      etymology: '', memoryTip: '' }
    let correctionCalls = 0
    const repair = mock.method(client.responses, 'create', async () => {
      correctionCalls++
      return output(correctionCalls === 1 ? mixed : { ...mixed,
        contextualMeaning: '임기 말에 공직자의 권한과 영향력이 급격히 줄어드는 상황',
        etymology: '두 한자가 합쳐진 말이에요.', memoryTip: '도전장을 내미는 장면을 떠올려요.' })
    })
    const request = { text: '도전해요.', inputLanguage: 'ko' as const, learningLanguage: 'ja' as const,
      sentences: [{ inputText: '도전해요.', learningSentence: item.exampleSentence }] }
    const repaired = await generateSentenceVocabulary(request)
    assert.equal(correctionCalls, 2)
    assert.equal(repaired[0][0].contextualMeaning, '임기 말에 공직자의 권한과 영향력이 급격히 줄어드는 상황')
    assert.ok(repaired[0][0].memoryTip)
    assert.ok(repaired[0][0].etymology)
    repair.mock.restore()

    const failedRepair = mock.method(client.responses, 'create', async () => output(mixed))
    await assert.rejects(generateSentenceVocabulary(request), /한국어 설명을 완성하지 못했어요/)
    failedRepair.mock.restore()

    const method = mock.method(client.responses, 'create', async () => output(item))
    const result = await generateSentenceVocabulary({ text: '도전해요.', inputLanguage: 'ko', learningLanguage: 'ja',
      sentences: [{ inputText: '도전해요.', learningSentence: item.exampleSentence }] })
    assert.equal(result[0][0].pronunciation, '')
    assert.equal(result[0][0].etymology, '')
    assert.equal(result[0][0].word, item.word)
    method.mock.restore()
  } finally {
    mock.restoreAll()
  }
})
