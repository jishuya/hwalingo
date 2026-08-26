import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { analyzeSentence, languageNames, type LanguageCode } from '../services/openai.js'
import { pool } from '../config/database.js'
import { recordLearningActivity } from '../services/learningActivity.js'

export const analysisRouter = Router()

analysisRouter.post('/', requireAuth, async (request, response, next) => {
  const startedAt = Date.now()
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
    const analysis = await analyzeSentence({ text, sourceLanguage, targetLanguage })
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
