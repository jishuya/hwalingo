import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import type { SentenceAnalysis } from '../services/openai.js'

const execute = promisify(execFile)
const analysis: SentenceAnalysis = {
  inputLanguage: 'es', learningLanguage: 'en', detectedSourceLanguage: 'es',
  backgroundKnowledge: '일상에 관한 이야기예요.', warnings: [], sentences: [],
}

async function until(check: () => Promise<boolean>) {
  const deadline = Date.now() + 12_000
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'worker did not settle in time')
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}

test('durable analysis jobs: auth, deduplication, ownership, completion, failure and restart recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hwalingo-analysis-test-'))
  const pgBin = process.env.PG_BINDIR ?? '/usr/lib/postgresql/16/bin'
  const data = join(directory, 'data')
  let started = false
  let closeApp: (() => Promise<void>) | undefined
  let closePool: (() => Promise<void>) | undefined
  const workers: Array<() => Promise<void>> = []
  try {
    await execute(join(pgBin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale'])
    await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -h '' -p 55443`, '-w', 'start'])
    started = true
    Object.assign(process.env, { PGHOST: directory, PGPORT: '55443', PGDATABASE: 'postgres', PGUSER: 'postgres', PGPASSWORD: 'test', JWT_SECRET: 'analysis-test', DB_SSL: 'false' })
    const { pool } = await import('../config/database.js')
    closePool = () => pool.end()
    await pool.query(await readFile(new URL('../../../docs/db.sql', import.meta.url), 'utf8'))
    for (const file of ['003_quiz_sessions.sql', '004_user_growth.sql', '005_learning_streaks.sql', '010_ai_response_cache.sql', '020_sentence_analysis_jobs.sql']) {
      await pool.query(await readFile(new URL('../../sql/' + file, import.meta.url), 'utf8'))
    }
    await pool.query(await readFile(new URL('../../sql/020_sentence_analysis_jobs.sql', import.meta.url), 'utf8'))
    const { analysisRouter } = await import('./analysis.js')
    const { startAnalysisWorker } = await import('../services/analysisJobs.js')
    const app = express()
    app.use(express.json(), cookieParser())
    app.use('/analysis', analysisRouter)
    app.use(((error, _request, response, _next) => { response.status(500).json({ message: String(error) }) }) as express.ErrorRequestHandler)
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    closeApp = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const base = `http://127.0.0.1:${address.port}/analysis`
    const { rows: users } = await pool.query<{ id: string }>(`INSERT INTO users(email,password_hash,display_name) VALUES ('a@analysis.test','x','a'),('b@analysis.test','x','b') RETURNING id`)
    const send = (path: string, body?: object, userId = users[0].id) => fetch(base + path, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie: `hwalingo_session=${jwt.sign({ userId }, 'analysis-test')}` }, body: body ? JSON.stringify(body) : undefined,
    })
    const request = { text: ' Hola.  Mundo. ', inputLanguage: 'es', learningLanguage: 'en' }
    assert.equal((await fetch(base)).status, 404)
    assert.equal((await fetch(base + '/jobs/latest')).status, 401)
    assert.equal((await send('', { ...request, text: 'x'.repeat(501) })).status, 400)
    assert.equal((await send('', { ...request, learningLanguage: 'toString' })).status, 400)
    const posted = await send('', request)
    assert.equal(posted.status, 202)
    const { job } = await posted.json()
    assert.equal(job.status, 'queued')
    assert.equal(job.request.text, 'Hola. Mundo.')
    assert.equal((await (await send('', request)).json()).job.id, job.id)
    assert.equal((await send('', { ...request, text: 'Otra.' })).status, 409)
    assert.equal((await send('/jobs/' + job.id, undefined, users[1].id)).status, 404)
    assert.equal((await send('/jobs/not-a-uuid')).status, 400)
    assert.equal((await (await send('/jobs/latest', undefined, users[1].id)).json()).job, null)

    let release!: () => void
    let entered = 0
    const gate = new Promise<void>(resolve => { release = resolve })
    const generate = async () => { entered++; await gate; return analysis }
    workers.push(startAnalysisWorker(generate), startAnalysisWorker(generate))
    await until(async () => entered === 1)
    assert.equal((await (await send('/jobs/' + job.id)).json()).job.status, 'running')
    release()
    await until(async () => (await (await send('/jobs/' + job.id)).json()).job.status === 'completed')
    await Promise.all(workers.splice(0).map(stop => stop()))
    assert.equal(entered, 1)
    assert.deepEqual((await (await send('/jobs/latest')).json()).job.analysis, analysis)
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM learning_activities')).rows[0].n, 1)
    assert.equal((await pool.query('SELECT duration_seconds FROM learning_activities')).rows[0].duration_seconds, 0)

    // Emulate a process dying after claiming a different, uncached request.
    const recovered = (await (await send('', { ...request, text: 'Recuperar.' })).json()).job
    await pool.query(`UPDATE sentence_analysis_jobs SET status = 'running', attempts = 1 WHERE id = $1`, [recovered.id])
    workers.push(startAnalysisWorker(async () => analysis))
    await until(async () => (await (await send('/jobs/' + recovered.id)).json()).job.status === 'completed')
    await Promise.all(workers.splice(0).map(stop => stop()))
    assert.equal((await pool.query('SELECT attempts FROM sentence_analysis_jobs WHERE id=$1', [recovered.id])).rows[0].attempts, 2)
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM learning_activities')).rows[0].n, 2)

    const failed = (await (await send('', { ...request, text: 'Fallar.' })).json()).job
    workers.push(startAnalysisWorker(async () => { throw new Error('private upstream details') }))
    await until(async () => (await (await send('/jobs/' + failed.id)).json()).job.status === 'failed')
    await Promise.all(workers.splice(0).map(stop => stop()))
    const failure = (await (await send('/jobs/' + failed.id)).json()).job
    assert.match(failure.message, /다시 시도/)
    assert.ok(!failure.message.includes('private'))
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM learning_activities')).rows[0].n, 2)

    const interrupted = (await (await send('', { ...request, text: 'Reiniciar.' })).json()).job
    let interruptedStarted = false
    const stopInterrupted = startAnalysisWorker(async (_request, signal) => {
      interruptedStarted = true
      return new Promise<SentenceAnalysis>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    workers.push(stopInterrupted)
    await until(async () => interruptedStarted)
    await stopInterrupted()
    workers.pop()
    assert.equal((await (await send('/jobs/' + interrupted.id)).json()).job.status, 'queued')
    workers.push(startAnalysisWorker(async () => analysis))
    await until(async () => (await (await send('/jobs/' + interrupted.id)).json()).job.status === 'completed')
    await Promise.all(workers.splice(0).map(stop => stop()))
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM learning_activities')).rows[0].n, 3)

    const exhausted = (await (await send('', { ...request, text: 'Interrumpir.' })).json()).job
    await pool.query(`UPDATE sentence_analysis_jobs SET status = 'running', attempts = 3 WHERE id = $1`, [exhausted.id])
    workers.push(startAnalysisWorker(async () => { assert.fail('exhausted jobs must not run') }))
    await until(async () => (await (await send('/jobs/' + exhausted.id)).json()).job.status === 'failed')
    await Promise.all(workers.splice(0).map(stop => stop()))
    // A user deletion also removes the saved input and analysis results.
    await pool.query('DELETE FROM users WHERE id = $1', [users[0].id])
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM sentence_analysis_jobs')).rows[0].n, 0)
  } finally {
    await Promise.all(workers.map(stop => stop()))
    await closeApp?.()
    await closePool?.()
    if (started) await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'])
    await rm(directory, { recursive: true, force: true })
  }
})
