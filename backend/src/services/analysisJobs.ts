import { randomUUID } from 'node:crypto'
import { pool } from '../config/database.js'
import { AI_RULES } from '../config/aiRules.js'
import { analyzeSentence, type AnalysisRequest, type SentenceAnalysis } from './openai.js'
import { withAIResponseCache } from './aiResponseCache.js'
import { recordLearningActivity } from './learningActivity.js'

export interface AnalysisJob {
  id: string
  user_id: string
  request_data: AnalysisRequest
  status: 'queued' | 'running' | 'completed' | 'failed'
  result: SentenceAnalysis | null
  error_message: string | null
}

export function presentAnalysisJob(job: AnalysisJob) {
  return { id: job.id, request: job.request_data, status: job.status, analysis: job.result, message: job.error_message }
}

export async function createAnalysisJob(userId: string, request: AnalysisRequest) {
  const { rows } = await pool.query<AnalysisJob>(
    `INSERT INTO sentence_analysis_jobs(id, user_id, request_data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id) WHERE status IN ('queued', 'running')
     DO UPDATE SET user_id = EXCLUDED.user_id RETURNING *`,
    [randomUUID(), userId, JSON.stringify(request)],
  )
  return rows[0]
}

export async function findAnalysisJob(userId: string, id?: string) {
  const { rows } = await pool.query<AnalysisJob>(
    `SELECT * FROM sentence_analysis_jobs WHERE user_id = $1
     AND ($2::uuid IS NULL OR id = $2::uuid)
     ORDER BY created_at DESC LIMIT 1`, [userId, id ?? null],
  )
  return rows[0]
}

const workerLock = 734_020
const interruptionMessage = '서버 작업이 반복해서 중단되었습니다. 다시 분석해 주세요.'

type GenerateAnalysis = (request: AnalysisRequest, signal: AbortSignal) => Promise<SentenceAnalysis>
const generateAnalysis: GenerateAnalysis = (request, signal) => analyzeSentence(request, signal)

// The session lock is held throughout generation. PostgreSQL releases it on process
// death; a new worker can then safely recover interrupted jobs without a lease race.
export function startAnalysisWorker(generate: GenerateAnalysis = generateAnalysis) {
  let stopped = false
  let active: Promise<void> | undefined
  const controller = new AbortController()
  let nextCleanupAt = 0

  const processNext = async () => {
    const client = await pool.connect()
    let locked = false
    try {
      const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [workerLock])
      locked = lock.rows[0].locked
      if (!locked || stopped) return
      await client.query(
        `UPDATE sentence_analysis_jobs SET
         status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
         error_message = CASE WHEN attempts >= 3 THEN $1 ELSE NULL END,
         finished_at = CASE WHEN attempts >= 3 THEN CURRENT_TIMESTAMP ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
         WHERE status = 'running' OR (status = 'queued' AND attempts >= 3)`,
        [interruptionMessage],
      )
      if (Date.now() >= nextCleanupAt) {
        await client.query(`DELETE FROM sentence_analysis_jobs WHERE finished_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`)
        nextCleanupAt = Date.now() + 3_600_000
      }
      const { rows } = await client.query<AnalysisJob>(
        `UPDATE sentence_analysis_jobs SET status = 'running', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT id FROM sentence_analysis_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1)
         RETURNING *`,
      )
      const job = rows[0]
      if (!job) return
      const startedAt = Date.now()
      let inTransaction = false
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)])
      try {
        const analysis = await withAIResponseCache({
          userId: job.user_id,
          operation: 'sentence_analysis_core_v26',
          keyParts: job.request_data,
          ttlMs: AI_RULES.cache.sentenceAnalysisTtlMs,
          generate: () => generate(job.request_data, signal),
        })
        controller.signal.throwIfAborted()
        await client.query('BEGIN')
        inTransaction = true
        // Completion and activity are atomic, so recovery never counts an activity twice.
        const completed = await client.query(
          `UPDATE sentence_analysis_jobs SET status = 'completed', result = $2::jsonb,
           finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
          [job.id, JSON.stringify(analysis)],
        )
        if (completed.rowCount) await recordLearningActivity(client, job.user_id, 'analysis')
        await client.query('COMMIT')
        inTransaction = false
        console.info(JSON.stringify({ event: 'sentence_analysis_job_completed', jobId: job.id, durationMs: Date.now() - startedAt }))
      } catch (error) {
        if (inTransaction) await client.query('ROLLBACK')
        const message = error instanceof Error && error.name === 'APIConnectionTimeoutError'
          ? 'AI 응답 시간이 초과되었습니다. 다시 분석해 주세요.'
          : 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        await client.query(
          `UPDATE sentence_analysis_jobs SET status = $2, error_message = $3,
           finished_at = CASE WHEN $2 = 'failed' THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [job.id, stopped ? 'queued' : 'failed', stopped ? null : message],
        )
        console.error(JSON.stringify({ event: 'sentence_analysis_job_failed', jobId: job.id, errorName: error instanceof Error ? error.name : 'UnknownError' }))
      }
    } finally {
      try {
        if (locked) await client.query('SELECT pg_advisory_unlock($1)', [workerLock])
      } finally {
        client.release()
      }
    }
  }
  const tick = () => {
    if (stopped || active) return
    active = processNext().catch(error => {
      console.error(JSON.stringify({ event: 'sentence_analysis_worker_failed', errorName: error instanceof Error ? error.name : 'UnknownError' }))
    }).finally(() => { active = undefined })
  }
  const timer = setInterval(tick, 1_000)
  timer.unref()
  tick()
  return async () => {
    stopped = true
    clearInterval(timer)
    controller.abort()
    await active
  }
}
