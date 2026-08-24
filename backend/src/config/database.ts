import pg from 'pg'
import { env } from './env.js'

const { Pool } = pg

export const pool = new Pool({
  host: env.pgHost,
  port: env.pgPort,
  database: env.pgDatabase,
  user: env.pgUser,
  password: env.pgPassword,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error)
})

export async function closeDatabase(): Promise<void> {
  await pool.end()
}
