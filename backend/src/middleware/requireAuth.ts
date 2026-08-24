import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface AuthTokenPayload {
  userId: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload
    }
  }
}

export const requireAuth: RequestHandler = (request, response, next) => {
  const token = request.cookies?.hwalingo_session as string | undefined

  if (!token) {
    response.status(401).json({ status: 'error', message: '로그인이 필요합니다.' })
    return
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    if (typeof payload === 'string' || typeof payload.userId !== 'string') {
      throw new Error('Invalid authentication token')
    }
    request.auth = { userId: payload.userId }
    next()
  } catch {
    response.clearCookie('hwalingo_session', { path: '/' })
    response.status(401).json({ status: 'error', message: '로그인이 만료되었습니다.' })
  }
}
