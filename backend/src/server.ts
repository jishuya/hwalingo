import { app } from './app.js'
import { closeDatabase } from './config/database.js'
import { env } from './config/env.js'

const server = app.listen(env.port, env.host)

server.on('listening', () => {
  console.log(`Hwalingo API listening on http://${env.host}:${env.port}`)
})

server.on('error', (error) => {
  console.error(`Failed to start Hwalingo API on ${env.host}:${env.port}`, error)
  process.exit(1)
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
