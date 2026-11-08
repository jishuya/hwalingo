import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiFetch, SESSION_EXPIRED_EVENT } from '../src/services/apiFetch.ts'

test('protected API 401 signals expiry while public auth failures and other errors do not', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const events = new EventTarget()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events })
  let expired = 0
  events.addEventListener(SESSION_EXPIRED_EVENT, () => { expired++ })
  try {
    for (const status of [200, 401, 403, 500]) {
      globalThis.fetch = async () => new Response('{}', { status })
      for (const path of ['/api/auth/login', '/api/auth/signup', '/api/auth/forgot-password', '/api/auth/reset-password']) {
        assert.equal((await apiFetch(path)).status, status)
      }
      const before = expired
      for (const path of ['/api/auth/me', '/api/analysis', '/api/vocabularies', '/api/quiz/sessions', '/api/stories', '/api/progress/me', '/api/settings/me']) {
        assert.equal((await apiFetch(path)).status, status)
      }
      assert.equal(expired - before, status === 401 ? 7 : 0)
    }
    assert.equal(expired, 7)
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
