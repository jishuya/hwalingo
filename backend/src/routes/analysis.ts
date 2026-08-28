import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { analyzeSentence, generateSentenceParaphrases, languageNames, type LanguageCode } from '../services/openai.js'
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

analysisRouter.post('/', requireAuth, async (request, response, next) => {
  const startedAt = Date.now()
  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
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
    const analysis = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_analysis_core_v2',
      keyParts: { text, sourceLanguage, targetLanguage },
      ttlMs: AI_RULES.cache.sentenceAnalysisTtlMs,
      generate: () => analyzeSentence({ text, sourceLanguage, targetLanguage }, abortController.signal),
      coalesce: false,
    })
    const client = await pool.connect()
    try {
      await recordLearningActivity(client, request.auth!.userId, 'analysis', {
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      })
    } finally {
      client.release()
    }
    response.json({ analysis })
  } catch (error) {
    next(error)
  }
})
