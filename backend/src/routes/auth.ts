import bcrypt from 'bcryptjs'
import { createHash, randomInt } from 'node:crypto'
import { Router, type CookieOptions, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../config/database.js'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { isMailConfigured, sendPasswordResetCode } from '../services/mail.js'

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string
}

interface PublicUser {
  id: string
  email: string
  displayName: string
}

interface PasswordResetRow {
  id: string
  user_id: string
}

const SESSION_COOKIE = 'hwalingo_session'
const SHORT_SESSION_SECONDS = 60 * 60 * 24
const LONG_SESSION_SECONDS = 60 * 60 * 24 * 30

export const authRouter = Router()

function passwordValidationMessage(password: string): string | undefined {
  if (password.length < 8 || password.length > 72 || !/[^A-Za-z0-9\s]/.test(password)) {
    return '비밀번호는 8자 이상이며 특수문자를 1개 이상 포함해야 합니다.'
  }
}

function hashResetCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function publicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
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
    const displayName = typeof request.body.displayName === 'string' ? request.body.displayName : ''

    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(email)) {
      response.status(400).json({ status: 'error', message: '이메일 주소에는 한글을 사용할 수 없습니다.' })
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ status: 'error', message: '올바른 이메일을 입력해주세요.' })
      return
    }
    const passwordError = passwordValidationMessage(password)
    if (passwordError) {
      response.status(400).json({ status: 'error', message: passwordError })
      return
    }
    if (!displayName) {
      response.status(400).json({ status: 'error', message: '이름을 입력해주세요.' })
      return
    }
    if (/\s/.test(displayName)) {
      response.status(400).json({ status: 'error', message: '이름에는 띄어쓰기를 사용할 수 없습니다.' })
      return
    }
    if (displayName.length < 2 || displayName.length > 20) {
      response.status(400).json({ status: 'error', message: '이름은 2자 이상 20자 이하로 입력해주세요.' })
      return
    }
    if (!/^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]+$/.test(displayName)) {
      response.status(400).json({ status: 'error', message: '이름에는 한글과 영문만 사용할 수 있습니다.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const result = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, display_name`,
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
      `SELECT id, email, password_hash, display_name
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

authRouter.post('/forgot-password', async (request, response, next) => {
  try {
    if (!isMailConfigured) {
      response.status(503).json({ status: 'error', message: '이메일 발송 설정이 완료되지 않았습니다.' })
      return
    }

    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const result = await pool.query<Pick<UserRow, 'id'>>('SELECT id FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user) {
      response.json({ message: '가입된 이메일이라면 재설정 코드를 전송했습니다.' })
      return
    }

    const resetCode = randomInt(100000, 1000000).toString()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= NOW()', [user.id])
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
        [user.id, hashResetCode(resetCode)],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    try {
      await sendPasswordResetCode(email, resetCode)
    } catch (error) {
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND token_hash = $2', [user.id, hashResetCode(resetCode)])
      console.error('Password reset email delivery failed', error)
      response.status(502).json({ status: 'error', message: '인증코드 이메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.' })
      return
    }

    response.json({ message: '가입된 이메일이라면 재설정 코드를 전송했습니다.' })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/reset-password', async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const resetCode = typeof request.body.resetCode === 'string' ? request.body.resetCode.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const passwordError = passwordValidationMessage(password)

    if (passwordError) {
      response.status(400).json({ status: 'error', message: passwordError })
      return
    }
    if (!/^\d{6}$/.test(resetCode)) {
      response.status(400).json({ status: 'error', message: '6자리 재설정 코드를 입력해주세요.' })
      return
    }

    const tokenResult = await pool.query<PasswordResetRow>(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1 AND prt.token_hash = $2
         AND prt.used_at IS NULL AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC LIMIT 1`,
      [email, hashResetCode(resetCode)],
    )
    const token = tokenResult.rows[0]
    if (!token) {
      response.status(400).json({ status: 'error', message: '재설정 코드가 올바르지 않거나 만료되었습니다.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, token.user_id])
      await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [token.id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    response.json({ message: '비밀번호가 변경되었습니다.' })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name
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

authRouter.patch('/me', requireAuth, async (request, response, next) => {
  try {
    const displayName = typeof request.body.displayName === 'string' ? request.body.displayName.trim() : ''
    if (displayName.length < 2 || displayName.length > 20 || /\s/.test(displayName) || !/^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]+$/.test(displayName)) {
      response.status(400).json({ status: 'error', message: '이름은 띄어쓰기 없이 한글과 영문 2~20자로 입력해주세요.' })
      return
    }
    const result = await pool.query<UserRow>(
      `UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, password_hash, display_name`,
      [displayName, request.auth!.userId],
    )
    response.json({ user: publicUser(result.rows[0]) })
  } catch (error) {
    next(error)
  }
})

authRouter.patch('/password', requireAuth, async (request, response, next) => {
  try {
    const currentPassword = typeof request.body.currentPassword === 'string' ? request.body.currentPassword : ''
    const newPassword = typeof request.body.newPassword === 'string' ? request.body.newPassword : ''
    const passwordError = passwordValidationMessage(newPassword)
    if (passwordError) {
      response.status(400).json({ status: 'error', message: passwordError })
      return
    }
    const result = await pool.query<Pick<UserRow, 'password_hash'>>('SELECT password_hash FROM users WHERE id = $1', [request.auth!.userId])
    if (!result.rows[0] || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
      response.status(400).json({ status: 'error', message: '현재 비밀번호가 올바르지 않습니다.' })
      return
    }
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, request.auth!.userId])
    response.json({ message: '비밀번호가 변경되었습니다.' })
  } catch (error) {
    next(error)
  }
})

authRouter.delete('/me', requireAuth, async (request, response, next) => {
  try {
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const result = await pool.query<Pick<UserRow, 'password_hash'>>('SELECT password_hash FROM users WHERE id = $1', [request.auth!.userId])
    if (!result.rows[0] || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
      response.status(400).json({ status: 'error', message: '현재 비밀번호가 올바르지 않습니다.' })
      return
    }
    await pool.query('DELETE FROM users WHERE id = $1', [request.auth!.userId])
    response.clearCookie(SESSION_COOKIE, { path: '/' })
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(SESSION_COOKIE, { path: '/' })
  response.status(204).send()
})
