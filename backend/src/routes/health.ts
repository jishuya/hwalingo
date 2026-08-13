import { Router } from 'express'
import { pool } from '../config/database.js'

export const healthRouter = Router()

healthRouter.get('/', async (_request, response, next) => {
  try {
    const result = await pool.query<{ now: Date }>('SELECT NOW() AS now')
    response.json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].now,
    })
  } catch (error) {
    next(error)
  }
})
