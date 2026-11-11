import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeSentence, getLatestAnalysisJob, type AnalysisJob, type SentenceAnalysis } from '../src/services/analysis.ts'

const analysis: SentenceAnalysis = {
  inputLanguage: 'es', learningLanguage: 'en', detectedSourceLanguage: 'es',
  backgroundKnowledge: '일상 이야기예요.', warnings: [], sentences: [],
}
const request = { text: 'Hola.', inputLanguage: 'es', learningLanguage: 'en' } as const
const pending: AnalysisJob = { id: 'saved-job', request, status: 'queued', analysis: null, message: null }
const completed: AnalysisJob = { ...pending, status: 'completed', analysis }
const response = (job: AnalysisJob | null, status = 200) => new Response(JSON.stringify({ job }), { status })

test('analysis polling, recovery, upstream failure, auth and cancellation', async t => {
  const originalFetch = globalThis.fetch
  try {
    await t.test('POST returns immediately and completed job is polled without a second POST', async () => {
      const calls: Array<{ path: string; method?: string }> = []
      globalThis.fetch = async (path, options) => {
        calls.push({ path: String(path), method: options?.method })
        return response(calls.length === 1 ? pending : completed, calls.length === 1 ? 202 : 200)
      }
      assert.deepEqual(await analyzeSentence(request), analysis)
      assert.equal(calls.length, 2)
      assert.equal(calls[0].method, 'POST')
      assert.equal(calls[1].path, '/api/analysis/jobs/saved-job')
    })
    await t.test('reopening a completed job does not create another job', async () => {
      globalThis.fetch = async (path, options) => {
        assert.equal(path, '/api/analysis/jobs/saved-job')
        assert.equal(options?.method, 'GET')
        assert.equal(options?.body, undefined)
        return response(completed)
      }
      assert.deepEqual(await analyzeSentence(request, undefined, pending.id), analysis)
    })
    await t.test('failed generation shows the saved Korean error', async () => {
      globalThis.fetch = async () => response({ ...pending, status: 'failed', message: 'AI 응답 시간이 초과되었습니다.' })
      await assert.rejects(analyzeSentence(request), /응답 시간이 초과/)
    })
    await t.test('non-JSON 504 gives useful guidance', async () => {
      globalThis.fetch = async () => new Response('<html>timeout</html>', { status: 504 })
      await assert.rejects(analyzeSentence(request), /같은 문장으로 다시 분석/)
    })
    await t.test('abort stops polling without cancelling the durable server job', async () => {
      const controller = new AbortController()
      let calls = 0
      globalThis.fetch = async () => { calls++; queueMicrotask(() => controller.abort()); return response(pending, 202) }
      await assert.rejects(analyzeSentence(request, controller.signal), { name: 'AbortError' })
      assert.equal(calls, 1)
    })
    await t.test('expired auth stops polling rather than retrying', async () => {
      let calls = 0
      globalThis.fetch = async () => ++calls === 1 ? response(pending, 202) : new Response(JSON.stringify({ message: '로그인이 만료되었습니다.' }), { status: 401 })
      await assert.rejects(analyzeSentence(request), /로그인이 만료/)
      assert.equal(calls, 2)
    })
    await t.test('latest analysis is loaded from the authenticated API', async () => {
      globalThis.fetch = async path => { assert.equal(path, '/api/analysis/jobs/latest'); return response(completed) }
      assert.deepEqual(await getLatestAnalysisJob(), completed)
    })
  } finally { globalThis.fetch = originalFetch }
})
