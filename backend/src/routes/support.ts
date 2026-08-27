import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { isMailConfigured, sendSupportInquiry } from '../services/mail.js'

const categories = new Set(['사용 방법', '계정 및 로그인', '학습 및 퀴즈', '오류 신고', '기타'])
export const supportRouter = Router()

supportRouter.post('/inquiries', requireAuth, async (request, response, next) => {
  try {
    if (!isMailConfigured) {
      response.status(503).json({ status: 'error', message: '문의 메일 발송 설정이 완료되지 않았습니다.' })
      return
    }
    const category = typeof request.body.category === 'string' ? request.body.category : ''
    const message = typeof request.body.message === 'string' ? request.body.message.trim() : ''
    if (!categories.has(category) || message.length < 10 || message.length > 2000) {
      response.status(400).json({ status: 'error', message: '문의 유형과 10~2,000자의 문의 내용을 확인해주세요.' })
      return
    }
    const userResult = await pool.query<{ email: string; display_name: string }>('SELECT email, display_name FROM users WHERE id = $1', [request.auth!.userId])
    const user = userResult.rows[0]
    if (!user) {
      response.status(404).json({ status: 'error', message: '사용자를 찾을 수 없습니다.' })
      return
    }
    await sendSupportInquiry({ userName: user.display_name, userEmail: user.email, category, message })
    response.status(201).json({ message: '문의가 전송되었습니다.' })
  } catch (error) {
    next(error)
  }
})
