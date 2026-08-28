import { createHash } from 'node:crypto'
import { pool } from '../config/database.js'

interface CachedAIRequest<T> {
  userId: string
  operation: string
  keyParts: unknown
  ttlMs: number
  generate: () => Promise<T>
  coalesce?: boolean
}

interface CacheRow<T> {
  response_data: T
}

const inFlightRequests = new Map<string, Promise<unknown>>()

interface CacheIdentity {
  userId: string
  operation: string
  keyParts: unknown
}

interface CacheWrite<T> extends CacheIdentity {
  value: T
  ttlMs: number
}

export function createAICacheKey(keyParts: unknown): string {
  return createHash('sha256').update(JSON.stringify(keyParts)).digest('hex')
}

export async function readAIResponseCache<T>({ userId, operation, keyParts }: CacheIdentity): Promise<T | undefined> {
  const cacheKey = createAICacheKey(keyParts)
  try {
    const cached = await pool.query<CacheRow<T>>(
      `SELECT response_data
       FROM ai_response_cache
       WHERE user_id = $1 AND operation = $2 AND cache_key = $3 AND expires_at > CURRENT_TIMESTAMP`,
      [userId, operation, cacheKey],
    )
    if (cached.rows[0]) console.info(JSON.stringify({ event: 'ai_cache_hit', operation }))
    else console.info(JSON.stringify({ event: 'ai_cache_miss', operation }))
    return cached.rows[0]?.response_data
  } catch (error) {
    console.warn(JSON.stringify({ event: 'ai_cache_read_failed', operation, errorName: error instanceof Error ? error.name : 'UnknownError' }))
    return undefined
  }
}

export async function writeAIResponseCache<T>({ userId, operation, keyParts, value, ttlMs }: CacheWrite<T>): Promise<void> {
  const cacheKey = createAICacheKey(keyParts)
  const expiresAt = new Date(Date.now() + ttlMs)
  try {
    await pool.query(
      `INSERT INTO ai_response_cache (user_id, operation, cache_key, response_data, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (user_id, operation, cache_key) DO UPDATE
       SET response_data = EXCLUDED.response_data,
           created_at = CURRENT_TIMESTAMP,
           expires_at = EXCLUDED.expires_at`,
      [userId, operation, cacheKey, JSON.stringify(value), expiresAt],
    )
  } catch (error) {
    console.warn(JSON.stringify({ event: 'ai_cache_write_failed', operation, errorName: error instanceof Error ? error.name : 'UnknownError' }))
  }
}

export async function withAIResponseCache<T>({ userId, operation, keyParts, ttlMs, generate, coalesce = true }: CachedAIRequest<T>): Promise<T> {
  const cached = await readAIResponseCache<T>({ userId, operation, keyParts })
  if (cached !== undefined) return cached
  if (!coalesce) {
    const result = await generate()
    await writeAIResponseCache({ userId, operation, keyParts, value: result, ttlMs })
    return result
  }
  const requestKey = `${userId}:${operation}:${createAICacheKey(keyParts)}`
  const existingRequest = inFlightRequests.get(requestKey) as Promise<T> | undefined
  if (existingRequest) {
    console.info(JSON.stringify({ event: 'ai_request_coalesced', operation }))
    return existingRequest
  }
  const generation = (async () => {
    const result = await generate()
    await writeAIResponseCache({ userId, operation, keyParts, value: result, ttlMs })
    return result
  })()
  inFlightRequests.set(requestKey, generation)
  try {
    return await generation
  } finally {
    if (inFlightRequests.get(requestKey) === generation) inFlightRequests.delete(requestKey)
  }
}
