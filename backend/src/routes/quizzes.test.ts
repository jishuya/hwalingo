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
  items: Array<{ id: string; word: string; reviewIntervalMinutes: number | null; choices: string[]; result: string | null; retryOfItemId: string | null }>
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
    for (const file of (await readdir(sqlDirectory)).filter(file => /^(003|004|005|006|008|012|014|015|016)_/.test(file)).sort()) {
      try { await pool.query(await readFile(new URL(file, sqlDirectory), 'utf8')) } catch (error) { throw new Error(`Migration ${file} failed`, { cause: error }) }
    }
    // The migration can safely be reapplied.
    await pool.query(await readFile(new URL('015_quiz_retries.sql', sqlDirectory), 'utf8'))
    const { quizzesRouter } = await import('./quizzes.js')
    const app = express()
    app.use(express.json(), cookieParser())
    app.use('/api/quizzes', quizzesRouter)
    const { vocabulariesRouter } = await import('./vocabularies.js')
    app.use('/api/vocabularies', vocabulariesRouter)
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
    await t.test('standard tests require ten saved words, including words not yet due', async () => {
      for (let index = 0; index < 7; index++) {
        if ([0, 3, 6].includes(index)) {
          const response = await send('/sessions', { count: 10 })
          assert.equal(response.status, 409)
          const error = await response.json() as { code: string; message: string }
          assert.equal(error.code, 'INSUFFICIENT_VOCABULARY')
          assert.ok(error.message.includes(`현재 ${3 + index}개`))
          assert.ok(error.message.includes(`${7 - index}개를 더 저장`))
          assert.equal((await pool.query('SELECT id FROM quiz_sessions')).rowCount, 0)
        }
        await seed(`future-padding-${index}`)
      }
      const firstSession = await create(10)
      assert.equal(firstSession.totalCount, 10)
      assert.equal(firstSession.items.length, 10)
      // An active session must not bypass the saved-word minimum when reopened.
      const temporarilyArchived = ['future-padding-0', 'future-padding-1', 'future-padding-2', 'future-padding-3']
      await pool.query(`UPDATE vocabularies SET archived_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND word = ANY($2::text[])`, [userId, temporarilyArchived])
      const blockedResume = await send('/sessions', { count: 10 })
      assert.equal(blockedResume.status, 409)
      const resumeError = await blockedResume.json() as { code: string; message: string }
      assert.equal(resumeError.code, 'INSUFFICIENT_VOCABULARY')
      assert.ok(resumeError.message.includes('현재 6개'))
      assert.ok(resumeError.message.includes('4개를 더 저장'))
      assert.equal((await pool.query('SELECT status FROM quiz_sessions WHERE id = $1', [firstSession.id])).rows[0].status, 'active')
      await pool.query(`UPDATE vocabularies SET archived_at = NULL WHERE user_id = $1 AND word = ANY($2::text[])`, [userId, temporarilyArchived])
      assert.equal((await create(10)).id, firstSession.id)
      await pool.query(`UPDATE quiz_sessions SET status = 'abandoned' WHERE id = $1`, [firstSession.id])
      await pool.query(`UPDATE vocabulary_progress p SET total_attempts = 1, correct_count = 1,
        next_review_at = CURRENT_TIMESTAMP + INTERVAL '30 days'
        FROM vocabularies v WHERE p.vocabulary_id = v.id AND v.word LIKE 'future-padding-%'`)
    })
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
    await t.test('additional sessions exclude answered words and future reviews, prioritize due masters, and handle exhaustion', async () => {
      const exhausted = await send('/sessions', { count: 10 })
      assert.equal(exhausted.status, 409)
      await seed('due-master'); await seed('future'); await seed('fresh')
      await pool.query(`UPDATE vocabulary_progress p SET total_attempts = 1, correct_count = 1, mastery_level = 6,
        next_review_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
        FROM vocabularies v WHERE p.vocabulary_id = v.id AND v.word = 'due-master'`)
      await pool.query(`UPDATE vocabulary_progress p SET total_attempts = 1, correct_count = 1,
        next_review_at = CURRENT_TIMESTAMP + INTERVAL '1 day'
        FROM vocabularies v WHERE p.vocabulary_id = v.id AND v.word = 'future'`)
      let session = await create(10)
      assert.deepEqual(session.items.map(item => item.word), ['due-master', 'fresh'])
      // Reopening still resumes this session.
      assert.equal((await create(10)).id, session.id)
      for (let index = 0; index < 2; index++) { await answer(session, true); session = await get(session.id) }
      assert.equal((await send('/sessions', { count: 10 })).status, 409)
      // A new local learning day restores the normal session selection.
      await pool.query(`UPDATE quiz_sessions SET completed_at = CURRENT_TIMESTAMP - INTERVAL '2 days' WHERE user_id = $1`, [userId])
      // Simulate a word becoming due on the new learning day.
      await pool.query(`UPDATE vocabulary_progress p SET next_review_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'
        FROM vocabularies v WHERE p.vocabulary_id = v.id AND v.word = 'future'`)
      session = await create(1)
      assert.equal(session.totalCount, 1)
      assert.equal(session.items[0].word, 'future')
      await answer(session, true)
    })
    await t.test('a single remaining word stays active through repeated wrong answers', async () => {
      await seed('single-new')
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
    await t.test('incorrect mode only selects incorrect words, resumes separately, and preserves early-review mastery', async () => {
      await seed('standard-only')
      const standard = await create(1)
      const response = await send('/sessions', { count: 40, mode: 'incorrect' })
      assert.equal(response.status, 201, await response.clone().text())
      let session = (await response.json() as { session: QuizSession }).session
      assert.notEqual(session.id, standard.id)
      const incorrectWords = (await pool.query(`SELECT v.word FROM vocabularies v JOIN vocabulary_progress p ON p.vocabulary_id = v.id WHERE p.user_id = $1 AND p.incorrect_count > 0`, [userId])).rows.map(row => row.word)
      assert.deepEqual(session.items.map(item => item.word).sort(), incorrectWords.sort())
      assert.equal((await create(1)).id, standard.id)
      const resumed = await send('/sessions', { mode: 'incorrect' })
      assert.equal((await resumed.json() as { session: QuizSession }).session.id, session.id)
      // All selected words are early reviews; today's wrong words are still available in this mode.
      await pool.query(`UPDATE vocabulary_progress SET next_review_at = CURRENT_TIMESTAMP + INTERVAL '30 days' WHERE user_id = $1`, [userId])
      const before = (await pool.query(`SELECT vocabulary_id, mastery_level, next_review_at FROM vocabulary_progress WHERE user_id = $1 ORDER BY vocabulary_id`, [userId])).rows
      while (pending(session).length) { await answer(session, true); session = await get(session.id) }
      assert.deepEqual((await pool.query(`SELECT vocabulary_id, mastery_level, next_review_at FROM vocabulary_progress WHERE user_id = $1 ORDER BY vocabulary_id`, [userId])).rows, before)
      await answer(standard, true)
    })
    await t.test('six questions finish without retries even when ten were requested', async () => {
      for (let index = 0; index < 6; index++) await seed(`completion-${index}`)
      let session = await create(10)
      assert.equal(session.totalCount, 6)
      for (let index = 0; index < 6; index++) { await answer(session, true); session = await get(session.id) }
      assert.equal(session.status, 'completed')
      assert.equal(session.correctCount, 6)
      assert.equal(session.items.length, 6)
    })
    await t.test('resuming legacy sessions removes previously archived words and retries', async () => {
      await seed('legacy-a'); await seed('legacy-b'); await seed('legacy-c')
      let session = await create(3)
      const wrongWord = pending(session)[0].word
      await answer(session, false)
      session = await get(session.id)
      const untestedWord = pending(session)[0].word
      // Simulate deletion by the old backend, which left session items untouched.
      await pool.query('UPDATE vocabularies SET archived_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND word = ANY($2::text[])', [userId, [wrongWord, untestedWord]])
      const resumed = await create(3)
      assert.equal(resumed.id, session.id)
      assert.equal(resumed.totalCount, 2)
      assert.equal(pending(resumed).length, 1)
      assert.ok(pending(resumed).every(item => ![wrongWord, untestedWord].includes(item.word)))
      assert.equal(resumed.items.find(item => item.word === wrongWord)?.result, 'incorrect')
      await pool.query('UPDATE vocabularies SET archived_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND word = $2', [userId, pending(resumed)[0].word])
      session = await get(session.id)
      assert.equal(session.status, 'completed')
      assert.equal(session.totalCount, 1)
      assert.equal(pending(session).length, 0)
    })
    await t.test('deletion removes pending originals and retries while preserving answers and XP', async () => {
      await seed('delete-a'); await seed('delete-b'); await seed('delete-c')
      let session = await create(3)
      const removeWord = async (word: string) => {
        const vocabulary = await pool.query('SELECT id FROM vocabularies WHERE user_id = $1 AND word = $2', [userId, word])
        const response = await fetch(`${base.replace('/quizzes', '/vocabularies')}/${vocabulary.rows[0].id}`, { method: 'DELETE', headers: { cookie } })
        assert.equal(response.status, 204, await response.text())
      }
      const wrongWord = pending(session)[0].word
      await answer(session, false)
      session = await get(session.id)
      const untestedWord = pending(session)[0].word
      await removeWord(untestedWord)
      session = await get(session.id)
      assert.equal(session.totalCount, 2)
      assert.ok(!session.items.some(item => item.word === untestedWord))
      await answer(session, true)
      session = await get(session.id)
      const before = (await pool.query('SELECT correct_count, earned_xp FROM quiz_sessions WHERE id = $1', [session.id])).rows[0]
      await removeWord(wrongWord)
      session = await get(session.id)
      assert.equal(session.status, 'completed')
      assert.equal(pending(session).length, 0)
      assert.equal(session.items.find(item => item.word === wrongWord)?.result, 'incorrect')
      assert.deepEqual((await pool.query('SELECT correct_count, earned_xp FROM quiz_sessions WHERE id = $1', [session.id])).rows[0], before)
      await seed('delete-only')
      session = await create(1)
      await removeWord(pending(session)[0].word)
      session = await get(session.id)
      assert.equal(session.status, 'abandoned')
      assert.equal(session.totalCount, 0)
    })

    await t.test('short legacy sessions gain eligible words without losing answers, XP, or retries', async () => {
      const result = await pool.query<{ id: string }>(`INSERT INTO users(email, password_hash, display_name)
        VALUES ('short@test.local', 'test', 'test') RETURNING id`)
      const owner = result.rows[0].id
      const ownerCookie = `hwalingo_session=${jwt.sign({ userId: owner }, 'quiz-retry-test')}`
      const post = async (path: string, body: object) => {
        const response = await fetch(`${base}${path}`, { method: 'POST',
          headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        assert.ok(response.ok, await response.clone().text())
        return response.json()
      }
      const addWords = async (count: number, prefix: string) => {
        const words = await pool.query<{ id: string }>(`INSERT INTO vocabularies(user_id, word, meaning)
          SELECT $1, $2 || n, 'meaning ' || n FROM generate_series(1, $3::int) n RETURNING id`, [owner, prefix, count])
        for (const word of words.rows) await pool.query(
          'INSERT INTO vocabulary_progress(user_id, vocabulary_id) VALUES ($1, $2)', [owner, word.id])
      }
      await addWords(10, 'legacy-')
      let session = (await post('/sessions', { count: 10 })).session as QuizSession
      assert.ok(session.items.every(item => item.reviewIntervalMinutes === null))
      // Reproduce a six-question session left behind by an older version.
      await pool.query('DELETE FROM quiz_session_items WHERE session_id = $1 AND position > 6', [session.id])
      await pool.query('UPDATE quiz_sessions SET total_count = 6 WHERE id = $1', [session.id])
      for (let index = 0; index < 6; index++) await post(
        `/sessions/${session.id}/items/${session.items[index].id}/answer`, { selfReportedCorrect: index !== 0 })
      const before = (await pool.query('SELECT correct_count, earned_xp FROM quiz_sessions WHERE id = $1', [session.id])).rows[0]
      const history = (await pool.query('SELECT * FROM quiz_session_items WHERE session_id = $1 ORDER BY position', [session.id])).rows
      // Future reviews must not be pulled forward merely to make ten questions.
      await pool.query(`UPDATE vocabulary_progress SET total_attempts = 1, correct_count = 1,
        next_review_at = CURRENT_TIMESTAMP + INTERVAL '30 days' WHERE user_id = $1 AND total_attempts = 0`, [owner])
      session = (await post('/sessions', { count: 10 })).session
      assert.equal(session.totalCount, 6)
      await addWords(4, 'new-')
      const resumed = await Promise.all([post('/sessions', { count: 10 }), post('/sessions', { count: 10 })])
      for (const response of resumed) {
        assert.equal(response.session.id, session.id)
        assert.equal(response.session.totalCount, 10)
        assert.equal(response.session.items.filter((item: QuizSession['items'][number]) => !item.retryOfItemId).length, 10)
        assert.equal(response.session.items.filter((item: QuizSession['items'][number]) => item.retryOfItemId && !item.result).length, 1)
      }
      assert.deepEqual((await pool.query('SELECT correct_count, earned_xp FROM quiz_sessions WHERE id = $1', [session.id])).rows[0], before)
      assert.deepEqual((await pool.query('SELECT * FROM quiz_session_items WHERE session_id = $1 ORDER BY position LIMIT 7', [session.id])).rows, history)
      assert.equal((await post('/sessions', { count: 10 })).session.items.length, 11)
      await pool.query(`UPDATE vocabulary_progress SET total_attempts = 1, correct_count = 1, incorrect_count = 0,
        last_reviewed_at = CURRENT_TIMESTAMP, next_review_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
        WHERE user_id = $1`, [owner])
      const scheduled = (await post('/sessions', { count: 10 })).session as QuizSession
      assert.ok(scheduled.items.every(item => item.reviewIntervalMinutes === 7 * 24 * 60))
      await pool.query(`UPDATE vocabulary_progress SET next_review_at = last_reviewed_at + INTERVAL '10 minutes'
        WHERE user_id = $1`, [owner])
      const shortReview = (await post('/sessions', { count: 10 })).session as QuizSession
      assert.ok(shortReview.items.every(item => item.reviewIntervalMinutes === 10))
    })

  } finally {
    await closeApp?.()
    await closePool?.()
    if (started) await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'])
    await rm(directory, { recursive: true, force: true })
  }
})
