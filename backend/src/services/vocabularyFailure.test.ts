import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import type { Request, Response } from 'express'
import { VocabularyExplanationError } from './vocabularyPresentation.js'
import { errorHandler } from '../middleware/errorHandler.js'

process.env.JWT_SECRET = 'vocabulary-failure-test'
process.env.OPENAI_API_KEY = 'vocabulary-failure-test'

const good = { word: '收复', pronunciation: 'shōu fù', partOfSpeech: '동사', level: 'B2',
  basicMeaning: '되찾다', contextualMeaning: '잃었던 지위를 되찾다', etymology: '',
  memoryTip: '뺏긴 왕관을 다시 머리에 쓰는 장면을 떠올려요.',
  exampleSentence: '球队希望收复榜首位置。', exampleMeaning: '그 팀은 선두 자리를 되찾고 싶어 해요.' }
const request = { text: '잃었던 지위를 되찾는다.', inputLanguage: 'ko' as const, learningLanguage: 'zh' as const,
  sentences: [{ inputText: '잃었던 지위를 되찾는다.', learningSentence: good.exampleSentence }] }
const output = (item: typeof good) => ({ output_text: JSON.stringify({ sentences: [{ sentenceIndex: 0, vocabulary: [item] }] }) })

test('missing optional memory tip does not fail otherwise valid vocabulary after repair attempts', async () => {
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateSentenceVocabulary } = await import('./openai.js')
  const method = mock.method(getOpenAIClient().responses, 'create', async () => output({ ...good, memoryTip: '' }))
  try {
    const result = await generateSentenceVocabulary(request)
    assert.equal(method.mock.callCount(), 3)
    assert.equal(result[0][0].word, good.word)
    assert.equal(result[0][0].contextualMeaning, good.contextualMeaning)
    assert.equal(result[0][0].exampleMeaning, good.exampleMeaning)
    assert.equal(result[0][0].memoryTip, '')
  } finally { method.mock.restore() }
})

test('a second repair can recover a mixed-language context', async () => {
  const { getOpenAIClient } = await import('../config/openai.js')
  const { generateSentenceVocabulary } = await import('./openai.js')
  let calls = 0
  const method = mock.method(getOpenAIClient().responses, 'create', async () => output(++calls < 3
    ? { ...good, contextualMeaning: '되찾다: 重新夺回失去的位置' } : good))
  try {
    const result = await generateSentenceVocabulary(request)
    assert.equal(calls, 3)
    assert.equal(result[0][0].contextualMeaning, good.contextualMeaning)
  } finally { method.mock.restore() }
})

test('incomplete vocabulary is returned without writing it into the seven-day cache', async () => {
  const { pool } = await import('../config/database.js')
  const { withAIResponseCache } = await import('./aiResponseCache.js')
  for (const coalesce of [true, false]) {
    const queries: string[] = []
    const query = mock.method(pool, 'query', async (sql: string) => { queries.push(sql); return { rows: [] } })
    try {
      const value = [[{ ...good, memoryTip: '' }]]
      const result = await withAIResponseCache({ userId: '1', operation: 'vocabulary_failure_test', keyParts: {}, ttlMs: 1000,
        generate: async () => value, coalesce,
        shouldCache: groups => groups.every(items => items.every(item => Boolean(item.memoryTip))) })
      assert.deepEqual(result, value)
      assert.equal(queries.length, 1)
      assert.match(queries[0], /SELECT response_data/)
    } finally { query.mock.restore() }
  }
})

test('required explanation failure reaches the client with a Korean message and 502 status', () => {
  let status = 0
  let body: unknown
  const response = { status(code: number) { status = code; return this }, json(value: unknown) { body = value } } as Response
  errorHandler(new VocabularyExplanationError(), {} as Request, response, () => { throw new Error('unexpected next') })
  assert.equal(status, 502)
  assert.deepEqual(body, { status: 'error', message: new VocabularyExplanationError().message })
})
