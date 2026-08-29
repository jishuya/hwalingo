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
    const sourceLanguage = request.body.sourceLanguage as LanguageCode
    const targetLanguage = request.body.targetLanguage as LanguageCode
    const targetSentence = typeof request.body.targetSentence === 'string' ? request.body.targetSentence.trim() : ''
    if (!targetSentence || targetSentence.length > 1_000) {
      response.status(400).json({ status: 'error', message: '패러프레이징할 문장이 올바르지 않습니다.' })
      return
    }
    if (!(sourceLanguage in languageNames) || !(targetLanguage in languageNames) || sourceLanguage === targetLanguage) {
      response.status(400).json({ status: 'error', message: '언어 설정이 올바르지 않습니다.' })
      return
    }
    const paraphrases = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_paraphrases_v1',
      keyParts: { sourceLanguage, targetLanguage, targetSentence },
      ttlMs: AI_RULES.cache.sentenceParaphrasesTtlMs,
      generate: () => generateSentenceParaphrases({ sourceLanguage, targetLanguage, targetSentence }, abortController.signal),
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
    const sourceLanguage = request.body.sourceLanguage as LanguageCode
    const targetLanguage = request.body.targetLanguage as LanguageCode
    const rawSentences: unknown[] = Array.isArray(request.body.sentences) ? request.body.sentences : []
    const sentences: Array<{ sourceText: string; targetSentence: string }> = rawSentences.map((sentence: unknown) => {
      if (typeof sentence !== 'object' || sentence === null) return { sourceText: '', targetSentence: '' }
      const value = sentence as Record<string, unknown>
      return {
        sourceText: typeof value.sourceText === 'string' ? value.sourceText.trim() : '',
        targetSentence: typeof value.targetSentence === 'string' ? value.targetSentence.trim() : '',
      }
    })
    const totalCharacters = sentences.reduce((total, sentence) => total + sentence.sourceText.length + sentence.targetSentence.length, 0)
    if (!sentences.length || sentences.length > 20 || totalCharacters > 2_000 || sentences.some(sentence => !sentence.sourceText || !sentence.targetSentence)) {
      response.status(400).json({ status: 'error', message: '어휘를 분석할 문장이 올바르지 않습니다.' })
      return
    }
    if (!(sourceLanguage in languageNames) || !(targetLanguage in languageNames) || sourceLanguage === targetLanguage) {
      response.status(400).json({ status: 'error', message: '언어 설정이 올바르지 않습니다.' })
      return
    }
    const vocabularies = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_vocabulary_v1',
      keyParts: { sourceLanguage, targetLanguage, sentences },
      ttlMs: AI_RULES.cache.sentenceVocabularyTtlMs,
      generate: () => generateSentenceVocabulary({
        text: sentences.map(sentence => sentence.sourceText).join(' '),
        sourceLanguage,
        targetLanguage,
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
    const sourceLanguage = request.body.sourceLanguage as LanguageCode
    const targetLanguage = request.body.targetLanguage as LanguageCode
    if (!text) {
      response.status(400).json({ status: 'error', message: '분석할 문장을 입력해주세요.' })
      return
    }
    if (text.length > 500) {
      response.status(400).json({ status: 'error', message: '문장은 500자 이하로 입력해주세요.' })
      return
    }
    if (!(sourceLanguage in languageNames) || !(targetLanguage in languageNames)) {
      response.status(400).json({ status: 'error', message: '지원하지 않는 언어입니다.' })
      return
    }
    if (sourceLanguage === targetLanguage) {
      response.status(400).json({ status: 'error', message: '서로 다른 언어를 선택해주세요.' })
      return
    }
    const generationStartedAt = Date.now()
    const analysis = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_analysis_core_v3',
      keyParts: { text, sourceLanguage, targetLanguage },
      ttlMs: AI_RULES.cache.sentenceAnalysisTtlMs,
      generate: () => analyzeSentence({ text, sourceLanguage, targetLanguage }, abortController.signal),
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
