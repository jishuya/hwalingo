import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { analyzeSentence, generateSentenceParaphrases, generateSentenceVocabulary, languageNames, type LanguageCode } from '../services/openai.js'
import { pool } from '../config/database.js'
import { recordLearningActivity } from '../services/learningActivity.js'
import { AI_RULES } from '../config/aiRules.js'
import { withAIResponseCache } from '../services/aiResponseCache.js'

export const analysisRouter = Router()

analysisRouter.post('/paraphrases', requireAuth, async (request, response, next) => {
  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
  try {
    const inputLanguage = request.body.inputLanguage as LanguageCode
    const learningLanguage = request.body.learningLanguage as LanguageCode
    const learningSentence = typeof request.body.learningSentence === 'string' ? request.body.learningSentence.trim() : ''
    if (!learningSentence || learningSentence.length > 1_000) {
      response.status(400).json({ status: 'error', message: '패러프레이징할 문장이 올바르지 않습니다.' })
      return
    }
    if (!(inputLanguage in languageNames) || !(learningLanguage in languageNames)) {
      response.status(400).json({ status: 'error', message: '언어 설정이 올바르지 않습니다.' })
      return
    }
    const paraphrases = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_paraphrases_v2',
      keyParts: { inputLanguage, learningLanguage, learningSentence },
      ttlMs: AI_RULES.cache.sentenceParaphrasesTtlMs,
      generate: () => generateSentenceParaphrases({ inputLanguage, learningLanguage, learningSentence }, abortController.signal),
      coalesce: false,
    })
    response.json({ paraphrases })
  } catch (error) {
    next(error)
  }
})

analysisRouter.post('/vocabulary', requireAuth, async (request, response, next) => {
  const startedAt = Date.now()
  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
  try {
    const inputLanguage = request.body.inputLanguage as LanguageCode
    const learningLanguage = request.body.learningLanguage as LanguageCode
    const rawSentences: unknown[] = Array.isArray(request.body.sentences) ? request.body.sentences : []
    const sentences: Array<{ inputText: string; learningSentence: string }> = rawSentences.map((sentence: unknown) => {
      if (typeof sentence !== 'object' || sentence === null) return { inputText: '', learningSentence: '' }
      const value = sentence as Record<string, unknown>
      return {
        inputText: typeof value.inputText === 'string' ? value.inputText.trim() : '',
        learningSentence: typeof value.learningSentence === 'string' ? value.learningSentence.trim() : '',
      }
    })
    const totalCharacters = sentences.reduce((total, sentence) => total + sentence.inputText.length + sentence.learningSentence.length, 0)
    if (!sentences.length || sentences.length > 20 || totalCharacters > 2_000 || sentences.some(sentence => !sentence.inputText || !sentence.learningSentence)) {
      response.status(400).json({ status: 'error', message: '어휘를 분석할 문장이 올바르지 않습니다.' })
      return
    }
    if (!(inputLanguage in languageNames) || !(learningLanguage in languageNames)) {
      response.status(400).json({ status: 'error', message: '언어 설정이 올바르지 않습니다.' })
      return
    }
    const vocabularies = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_vocabulary_v5',
      keyParts: { inputLanguage, learningLanguage, sentences },
      ttlMs: AI_RULES.cache.sentenceVocabularyTtlMs,
      generate: () => generateSentenceVocabulary({
        text: sentences.map(sentence => sentence.inputText).join(' '),
        inputLanguage,
        learningLanguage,
        sentences,
      }, abortController.signal),
      coalesce: false,
    })
    response.json({ vocabularies })
    console.info(JSON.stringify({
      event: 'sentence_vocabulary_response_sent',
      durationMs: Date.now() - startedAt,
      sentenceCount: sentences.length,
      vocabularyCount: vocabularies.reduce((total, items) => total + items.length, 0),
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'sentence_vocabulary_route_failed',
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }))
    next(error)
  }
})

analysisRouter.post('/', requireAuth, async (request, response, next) => {
  const startedAt = Date.now()
  const abortController = new AbortController()
  request.once('aborted', () => {
    abortController.abort()
    console.warn(JSON.stringify({
      event: 'sentence_analysis_client_aborted',
      durationMs: Date.now() - startedAt,
    }))
  })
  try {
    const text = typeof request.body.text === 'string' ? request.body.text.trim() : ''
    const inputLanguage = request.body.inputLanguage as LanguageCode
    const learningLanguage = request.body.learningLanguage as LanguageCode
    if (!text) {
      response.status(400).json({ status: 'error', message: '분석할 문장을 입력해주세요.' })
      return
    }
    if (text.length > 500) {
      response.status(400).json({ status: 'error', message: '문장은 500자 이하로 입력해주세요.' })
      return
    }
    if (!(inputLanguage in languageNames) || !(learningLanguage in languageNames)) {
      response.status(400).json({ status: 'error', message: '지원하지 않는 언어입니다.' })
      return
    }
    const generationStartedAt = Date.now()
    const analysis = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_analysis_core_v9',
      keyParts: { text, inputLanguage, learningLanguage },
      ttlMs: AI_RULES.cache.sentenceAnalysisTtlMs,
      generate: () => analyzeSentence({ text, inputLanguage, learningLanguage }, abortController.signal),
      coalesce: false,
    })
    console.info(JSON.stringify({
      event: 'sentence_analysis_generation_ready',
      durationMs: Date.now() - generationStartedAt,
      inputCharacters: text.length,
      sentenceCount: analysis.sentences.length,
    }))
    const activityStartedAt = Date.now()
    const client = await pool.connect()
    try {
      await recordLearningActivity(client, request.auth!.userId, 'analysis', {
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      })
    } finally {
      client.release()
    }
    console.info(JSON.stringify({
      event: 'sentence_analysis_activity_recorded',
      durationMs: Date.now() - activityStartedAt,
    }))
    response.json({ analysis })
    console.info(JSON.stringify({
      event: 'sentence_analysis_response_sent',
      durationMs: Date.now() - startedAt,
      responseCharacters: JSON.stringify(analysis).length,
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'sentence_analysis_route_failed',
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }))
    next(error)
  }
})
