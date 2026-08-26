import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { analysisRouter } from './routes/analysis.js'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'
import { quizzesRouter } from './routes/quizzes.js'
import { progressRouter } from './routes/progress.js'
import { storiesRouter } from './routes/stories.js'
import { vocabulariesRouter } from './routes/vocabularies.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api', (_request, response) => {
  response.json({ name: 'Hwalingo API', status: 'running' })
})
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/vocabularies', vocabulariesRouter)
app.use('/api/quizzes', quizzesRouter)
app.use('/api/progress', progressRouter)
app.use('/api/stories', storiesRouter)

app.use((_request, response) => {
  response.status(404).json({ status: 'error', message: 'Not found' })
})
app.use(errorHandler)
