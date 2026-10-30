import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
interface QuizSession {
  id: string
  status: string
  totalCount: number
  correctCount: number
  items: Array<{ id: string; word: string; choices: string[]; result: string | null; retryOfItemId: string | null }>
}
interface AnswerResult { isRetry?: boolean; xpEarned: number; nextReviewAt: string }

const execute = promisify(execFile)

// This suite creates its own disposable PostgreSQL cluster and never uses the application DB.
test('quiz retries preserve first answers, queue order, rewards, and resumability', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hwalingo-quiz-test-'))
  const pgBin = process.env.PG_BINDIR ?? '/usr/lib/postgresql/16/bin'
  const data = join(directory, 'data')
  await execute(join(pgBin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale'])
  let started = false
  let closeApp: (() => Promise<void>) | undefined
  let closePool: (() => Promise<void>) | undefined
  try {
    await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -h '' -p 55439`, '-w', 'start'])
    started = true
    Object.assign(process.env, { PGHOST: directory, PGPORT: '55439', PGDATABASE: 'postgres', PGUSER: 'postgres', PGPASSWORD: 'test', JWT_SECRET: 'quiz-retry-test', DB_SSL: 'false' })
    const { pool } = await import('../config/database.js')
    closePool = () => pool.end()
    await pool.query(await readFile(new URL('../../../docs/db.sql', import.meta.url), 'utf8'))
    const sqlDirectory = new URL('../../sql/', import.meta.url)
    for (const file of (await readdir(sqlDirectory)).filter(file => /^(003|004|005|006|008|012|014|015)_/.test(file)).sort()) {
      try { await pool.query(await readFile(new URL(file, sqlDirectory), 'utf8')) } catch (error) { throw new Error(`Migration ${file} failed`, { cause: error }) }
    }
    // The migration can safely be reapplied.
    await pool.query(await readFile(new URL('015_quiz_retries.sql', sqlDirectory), 'utf8'))
    const { quizzesRouter } = await import('./quizzes.js')
    const app = express()
    app.use(express.json(), cookieParser())
    app.use('/api/quizzes', quizzesRouter)
    app.use(((error, _request, response, _next) => { response.status(500).json({ message: String(error) }) }) as express.ErrorRequestHandler)
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    closeApp = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const base = `http://127.0.0.1:${address.port}/api/quizzes`
    const user = await pool.query<{ id: string }>(`INSERT INTO users(email, password_hash, display_name) VALUES ('retry@test.local', 'test', 'test') RETURNING id`)
    const userId = user.rows[0].id
    const cookie = `hwalingo_session=${jwt.sign({ userId }, 'quiz-retry-test')}`
    const send = (path: string, body?: object) => fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET', headers: { cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })
    const create = async (count: number) => {
      const response = await send('/sessions', { count })
      assert.ok(response.ok, await response.clone().text())
      return (await response.json() as { session: QuizSession }).session
    }
    const get = async (id: string) => (await (await send(`/sessions/${id}`)).json() as { session: QuizSession }).session
    const pending = (session: QuizSession) => session.items.filter(item => !item.result)
    const answer = async (session: QuizSession, correct: boolean) => {
      const response = await send(`/sessions/${session.id}/items/${pending(session)[0].id}/answer`, { selfReportedCorrect: correct, responseTimeMs: 100 })
      assert.equal(response.status, 200, await response.clone().text())
      return await response.json() as AnswerResult
    }
    const seed = async (word: string) => {
      const result = await pool.query<{ id: string }>(`INSERT INTO vocabularies(user_id, word, meaning) VALUES ($1, $2, $3) RETURNING id`, [userId, word, word])
      await pool.query(`INSERT INTO vocabulary_progress(user_id, vocabulary_id) VALUES ($1, $2)`, [userId, result.rows[0].id])
    }
    await seed('first'); await seed('second'); await seed('third')
    await t.test('wrong answers append to the end and repeated retries do not change statistics', async () => {
      let session = await create(3)
      const originalId = pending(session)[0].id
      const firstWord = pending(session)[0].word
      const early = await send(`/sessions/${session.id}/items/${pending(session)[1].id}/answer`, { selfReportedCorrect: true })
      assert.equal(early.status, 409)
      const initialChoices = pending(session)[0].choices
      const first = await answer(session, false)
      const progressSnapshot = (await pool.query('SELECT * FROM vocabulary_progress ORDER BY id')).rows
      const statsSnapshot = (await pool.query('SELECT * FROM user_learning_days')).rows
      session = await get(session.id)
      assert.equal(session.status, 'active')
      assert.equal(session.totalCount, 3)
      assert.equal(pending(session).length, 3)
      assert.equal(pending(session).at(-1)!.retryOfItemId, originalId)
      if (initialChoices.length > 1) assert.notDeepEqual(pending(session).at(-1)!.choices, initialChoices)
      assert.notEqual(pending(session)[0].word, firstWord)
      const resumed = await create(3)
      assert.equal(resumed.id, session.id)
      assert.deepEqual(pending(resumed), pending(session))
      await answer(session, true); session = await get(session.id)
      await answer(session, false); session = await get(session.id)
      assert.equal(pending(session).length, 2)
      const beforeRetry = (await pool.query('SELECT * FROM vocabulary_progress ORDER BY id')).rows
      const daysBeforeRetry = (await pool.query('SELECT * FROM user_learning_days')).rows
      const xpBeforeRetry = (await pool.query('SELECT * FROM user_progress')).rows
      const quizCount = (await pool.query('SELECT count(*) FROM quizzes')).rows
      const retry = pending(session)[0]
      const simultaneous = await Promise.all([false, false].map(selfReportedCorrect => send(
        `/sessions/${session.id}/items/${retry.id}/answer`, { selfReportedCorrect },
      )))
      assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 409])
      const retryResult = await simultaneous.find(result => result.status === 200)!.json() as AnswerResult
      assert.equal(retryResult.isRetry, true)
      assert.equal(retryResult.xpEarned, 0)
      assert.equal(retryResult.nextReviewAt, first.nextReviewAt)
      session = await get(session.id)
      assert.equal(pending(session).at(-1)!.word, retry.word)
      assert.equal(pending(session).filter(item => item.word === retry.word).length, 1)
      assert.equal(session.items.find(item => item.id === originalId)!.result, 'incorrect')
      assert.deepEqual((await pool.query('SELECT * FROM vocabulary_progress ORDER BY id')).rows, beforeRetry)
      assert.deepEqual((await pool.query('SELECT * FROM user_learning_days')).rows, daysBeforeRetry)
      assert.deepEqual((await pool.query('SELECT * FROM user_progress')).rows, xpBeforeRetry)
      assert.deepEqual((await pool.query('SELECT count(*) FROM quizzes')).rows, quizCount)
      assert.ok(progressSnapshot.length && statsSnapshot.length)
      // Duplicate submissions do not add a second retry.
      const duplicate = await send(`/sessions/${session.id}/items/${retry.id}/answer`, { selfReportedCorrect: false })
      assert.equal(duplicate.status, 409)
      assert.equal(pending(await get(session.id)).length, 2)
      await answer(session, true); session = await get(session.id)
      assert.equal(session.status, 'active')
      const final = await answer(session, true)
      assert.equal(final.xpEarned, 0)
      session = await get(session.id)
      assert.equal(session.status, 'completed')
      assert.equal(session.correctCount, 1)
      assert.equal(session.totalCount, 3)
      assert.equal(pending(session).length, 0)
      assert.equal(session.items.length, 6)
      assert.deepEqual((await pool.query('SELECT * FROM vocabulary_progress ORDER BY id')).rows, beforeRetry)
      assert.deepEqual((await pool.query('SELECT * FROM user_learning_days')).rows, daysBeforeRetry)
      assert.deepEqual((await pool.query('SELECT * FROM user_progress')).rows, xpBeforeRetry)
    })
    await t.test('a single remaining word stays active through repeated wrong answers', async () => {
      let session = await create(1)
      assert.equal(session.totalCount, 1)
      for (let index = 0; index < 3; index++) {
        await answer(session, false)
        session = await get(session.id)
        assert.equal(session.status, 'active')
        assert.equal(pending(session).length, 1)
      }
      await answer(session, true)
      session = await get(session.id)
      assert.equal(session.status, 'completed')
      assert.equal(session.correctCount, 0)
    })
    await t.test('all correct finishes without retries', async () => {
      let session = await create(2)
      for (let index = 0; index < 2; index++) { await answer(session, true); session = await get(session.id) }
      assert.equal(session.status, 'completed')
      assert.equal(session.correctCount, 2)
      assert.equal(session.items.length, 2)
    })
  } finally {
    await closeApp?.()
    await closePool?.()
    if (started) await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'])
    await rm(directory, { recursive: true, force: true })
  }
})
