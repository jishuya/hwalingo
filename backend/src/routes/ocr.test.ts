import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { env } from '../config/env.js'
import { ocrRouter } from './ocr.js'

test('OCR upload API validates input and handles Vision results', async () => {
  const app = express()
  app.use(cookieParser())
  app.use('/api/ocr', ocrRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/api/ocr`
  let calls = 0
  let mode: 'text' | 'empty' | 'quota' = 'text'
  const original = ImageAnnotatorClient.prototype.batchAnnotateImages
  ImageAnnotatorClient.prototype.batchAnnotateImages = (async () => {
    calls++
    if (mode === 'quota') throw Object.assign(new Error('quota'), { code: 8 })
    return [{ responses: [{ fullTextAnnotation: { text: mode === 'text' ? 'Hello world\n' : '' } }] }]
  }) as unknown as typeof original
  const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'white' } }).png().toBuffer()
  const send = (user: string | undefined, content?: Buffer) => {
    const body = new FormData()
    if (content) body.append('image', new Blob([new Uint8Array(content)], { type: 'image/png' }), 'photo.png')
    return fetch(url, { method: 'POST', body, headers: user ? { cookie: `hwalingo_session=${jwt.sign({ userId: user }, env.jwtSecret)}` } : {} })
  }
  try {
    assert.equal((await send(undefined, image)).status, 401)
    assert.equal((await send('missing')).status, 400)
    assert.equal((await send('invalid', Buffer.from('fake PNG'))).status, 400)
    assert.equal((await send('oversize', Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413)
    assert.equal(calls, 0)
    const result = await send('success', image)
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { text: 'Hello world' })
    mode = 'empty'
    assert.equal((await send('empty', image)).status, 422)
    mode = 'quota'
    assert.equal((await send('quota', image)).status, 429)
    for (let i = 0; i < 5; i++) assert.equal((await send('rate')).status, 400)
    assert.equal((await send('rate')).status, 429)
    assert.equal(calls, 3)
  } finally {
    ImageAnnotatorClient.prototype.batchAnnotateImages = original
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
