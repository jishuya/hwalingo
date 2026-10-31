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

const execute = promisify(execFile)
test('learning time deduplicates events and overlapping intervals, splits Seoul midnight, and isolates users', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hwalingo-time-test-'))
  const pgBin = process.env.PG_BINDIR ?? '/usr/lib/postgresql/16/bin'
  const data = join(directory, 'data')
  let started = false
  let closeApp: (() => Promise<void>) | undefined
  let closePool: (() => Promise<void>) | undefined
  try {
    await execute(join(pgBin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale'])
    await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -h '' -p 55440`, '-w', 'start'])
    started = true
    Object.assign(process.env, { PGHOST: directory, PGPORT: '55440', PGDATABASE: 'postgres', PGUSER: 'postgres', PGPASSWORD: 'test', JWT_SECRET: 'time-test', DB_SSL: 'false' })
    const { pool } = await import('../config/database.js')
    closePool = () => pool.end()
    await pool.query(await readFile(new URL('../../../docs/db.sql', import.meta.url), 'utf8'))
    const migration = await readFile(new URL('../../sql/018_learning_time.sql', import.meta.url), 'utf8')
    await pool.query(migration)
    await pool.query(migration)
    const { learningTimeRouter } = await import('./learningTime.js')
    const app = express()
    app.use(express.json(), cookieParser())
    app.use('/time', learningTimeRouter)
    app.use(((error, _request, response, _next) => { response.status(500).json({ message: String(error) }) }) as express.ErrorRequestHandler)
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    closeApp = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const base = `http://127.0.0.1:${address.port}/time`
    const users = await pool.query<{ id: string }>(`INSERT INTO users(email,password_hash,display_name) VALUES ('a@time.test','x','a'),('b@time.test','x','b') RETURNING id`)
    const userId = users.rows[0].id
    const send = (path: string, body?: object, id = userId) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie: `hwalingo_session=${jwt.sign({ userId: id }, 'time-test')}` }, body: body ? JSON.stringify(body) : undefined })
    assert.equal((await fetch(base + '/me')).status, 401)
    const now = Date.now() - 60_000
    const event = { id: crypto.randomUUID(), activity: 'quiz', startedAt: new Date(now - 20_000).toISOString(), endedAt: new Date(now).toISOString() }
    for (let i = 0; i < 2; i++) assert.equal((await send('/events', { userId, events: [event] })).status, 204)
    assert.equal((await send('/events', { userId, events: [{ ...event, id: crypto.randomUUID(), activity: 'story' }] })).status, 204)
    const summary = await (await send('/me')).json()
    assert.equal(summary.days.reduce((sum: number, day: { seconds: number }) => sum + day.seconds, 0), 20)
    assert.equal((await (await send('/me', undefined, users.rows[1].id)).json()).days.every((day: { seconds: number }) => day.seconds === 0), true)
    assert.equal((await send('/events', { userId: users.rows[1].id, events: [event] })).status, 403)
    assert.equal((await send('/events', { userId, events: [{ ...event, endedAt: new Date(now + 60_000).toISOString() }] })).status, 400)
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM learning_activities')).rows[0].count, 0)
    // Yesterday's Seoul midnight falls within the seven-day query window, regardless of host timezone.
    const { rows } = await pool.query<{ midnight: Date }>(`SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 1)::timestamp AT TIME ZONE 'Asia/Seoul' AS midnight`)
    const midnight = rows[0].midnight.getTime()
    const crossing = { id: crypto.randomUUID(), activity: 'analysis', startedAt: new Date(midnight - 10_000).toISOString(), endedAt: new Date(midnight + 10_000).toISOString() }
    assert.equal((await send('/events', { userId, events: [crossing] })).status, 204)
    const final = await (await send('/me')).json()
    assert.equal(final.days.reduce((sum: number, day: { seconds: number }) => sum + day.seconds, 0), 40)
    assert.equal(final.days.filter((day: { seconds: number }) => day.seconds === 10).length, 2)
  } finally {
    await closeApp?.()
    await closePool?.()
    if (started) await execute(join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'])
    await rm(directory, { recursive: true, force: true })
  }
})
