import { app } from './app.js'
import { closeDatabase } from './config/database.js'
import { env } from './config/env.js'

const server = app.listen(env.port, () => {
  console.log(`Hwalingo API listening on http://localhost:${env.port}`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down`)
  server.close(async () => {
    await closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
