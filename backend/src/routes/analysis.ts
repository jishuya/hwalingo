import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { analyzeSentence } from '../services/openai.js'

export const analysisRouter = Router()

analysisRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const text = typeof request.body.text === 'string' ? request.body.text.trim() : ''
    if (!text) {
      response.status(400).json({ status: 'error', message: '분석할 문장을 입력해주세요.' })
      return
    }
    if (text.length > 1000) {
      response.status(400).json({ status: 'error', message: '문장은 1,000자 이하로 입력해주세요.' })
      return
    }
    response.json({ analysis: await analyzeSentence(text) })
  } catch (error) {
    next(error)
  }
})
