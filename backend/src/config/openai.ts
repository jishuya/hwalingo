import OpenAI from 'openai'
import { env } from './env.js'

let client: OpenAI | undefined

export function getOpenAIClient(): OpenAI {
  if (!env.openaiApiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY')
  }

  client ??= new OpenAI({ apiKey: env.openaiApiKey })
  return client
}
