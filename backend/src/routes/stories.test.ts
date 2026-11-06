import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET ??= 'story-minimum-test-secret'
const { storiesRouter } = await import('./stories.js')
const { env } = await import('../config/env.js')
const { pool } = await import('../config/database.js')

// Exercise authentication and request validation without opening a port or using the DB/AI.
test('story generation requires 3–30 distinct word IDs before accessing the database', async () => {
  const databaseBoundary = new Error('database boundary reached')
  const query = mock.method(pool, 'query', () => { throw databaseBoundary })
  const token = jwt.sign({ userId:'1' },env.jwtSecret)
  const submit = (vocabularyIds:string[]) => new Promise<{status?:number;body?:{message:string};error?:unknown}>(resolve=>{
    let status:number|undefined
    const response = {
      status(value:number) { status=value;return this },
      json(body:{message:string}) { resolve({status,body});return this },
    } as unknown as Response
    storiesRouter({ method:'POST',url:'/',headers:{},cookies:{hwalingo_session:token},body:{vocabularyIds,genre:'daily',length:'short',difficulty:'normal'} } as unknown as Request,response,error=>resolve({error}))
  })
  try {
    for (const ids of [[],['1'],['1','2'],['1','1','2'],Array.from({length:31},(_,index)=>String(index+1))]) {
      const result = await submit(ids)
      assert.equal(result.status,400)
      assert.match(result.body!.message,/3개 이상 30개 이하/u)
    }
    assert.equal(query.mock.callCount(),0)
    for (const ids of [['1','2','3'],Array.from({length:30},(_,index)=>String(index+1))]) {
      const result = await submit(ids)
      assert.equal(result.error,databaseBoundary)
    }
    assert.equal(query.mock.callCount(),2)
  } finally { query.mock.restore();await pool.end() }
})
