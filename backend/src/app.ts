import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { healthRouter } from './routes/health.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())

app.get('/api', (_request, response) => {
  response.json({ name: 'Hwalingo API', status: 'running' })
})
app.use('/api/health', healthRouter)

app.use((_request, response) => {
  response.status(404).json({ status: 'error', message: 'Not found' })
})
app.use(errorHandler)
