import bcrypt from 'bcryptjs'
import { Router, type CookieOptions, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../config/database.js'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/requireAuth.js'

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string
  profile_image_url: string | null
}

interface PublicUser {
  id: string
  email: string
  displayName: string
  profileImageUrl: string | null
}

const SESSION_COOKIE = 'hwalingo_session'
const SHORT_SESSION_SECONDS = 60 * 60 * 24
const LONG_SESSION_SECONDS = 60 * 60 * 24 * 30

export const authRouter = Router()

function publicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    profileImageUrl: user.profile_image_url,
  }
}

function setSessionCookie(response: Response, userId: string, rememberMe: boolean): void {
  const maxAgeSeconds = rememberMe ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS
  const token = jwt.sign({ userId }, env.jwtSecret, { expiresIn: maxAgeSeconds })
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    ...(rememberMe ? { maxAge: maxAgeSeconds * 1000 } : {}),
  }

  response.cookie(SESSION_COOKIE, token, cookieOptions)
}

authRouter.post('/signup', async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const displayName = typeof request.body.displayName === 'string' ? request.body.displayName.trim() : ''

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ status: 'error', message: '올바른 이메일을 입력해주세요.' })
      return
    }
    if (password.length < 8 || password.length > 72) {
      response.status(400).json({ status: 'error', message: '비밀번호는 8자 이상 72자 이하로 입력해주세요.' })
      return
    }
    if (displayName.length < 2 || displayName.length > 100) {
      response.status(400).json({ status: 'error', message: '이름은 2자 이상 100자 이하로 입력해주세요.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const result = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, display_name, profile_image_url`,
      [email, passwordHash, displayName],
    )
    const user = result.rows[0]
    setSessionCookie(response, user.id, false)
    response.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ status: 'error', message: '이미 가입된 이메일입니다.' })
      return
    }
    next(error)
  }
})

authRouter.post('/login', async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const rememberMe = request.body.rememberMe === true

    const result = await pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, profile_image_url
       FROM users WHERE email = $1`,
      [email],
    )
    const user = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      response.status(401).json({ status: 'error', message: '이메일 또는 비밀번호가 올바르지 않습니다.' })
      return
    }

    setSessionCookie(response, user.id, rememberMe)
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, profile_image_url
       FROM users WHERE id = $1`,
      [request.auth!.userId],
    )
    const user = result.rows[0]

    if (!user) {
      response.clearCookie(SESSION_COOKIE, { path: '/' })
      response.status(401).json({ status: 'error', message: '사용자를 찾을 수 없습니다.' })
      return
    }
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(SESSION_COOKIE, { path: '/' })
  response.status(204).send()
})
