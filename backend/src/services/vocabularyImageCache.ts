import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'
import { generateVocabularyImage, type VocabularyInsightInput } from './vocabularyInsightsAI.js'

const cacheDirectory = fileURLToPath(new URL('../../data/ai-images/', import.meta.url))
const cacheVersion = 'v1'
const inFlightImages = new Map<string, Promise<{ base64: string; mimeType: string }>>()

function cacheKey(userId: string, input: VocabularyInsightInput): string {
  return createHash('sha256').update(JSON.stringify({
    cacheVersion,
    userId,
    model: env.openaiImageModel,
    word: input.word,
    meaning: input.meaning,
    contextMeaning: input.contextMeaning,
    languageCode: input.languageCode,
  })).digest('hex')
}

async function readCachedImage(key: string): Promise<{ base64: string; mimeType: string } | undefined> {
  try {
    const image = await readFile(`${cacheDirectory}/${key}.png`)
    console.info(JSON.stringify({ event: 'vocabulary_image_cache_hit' }))
    return { base64: image.toString('base64'), mimeType: 'image/png' }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(JSON.stringify({ event: 'vocabulary_image_cache_read_failed', errorName: error instanceof Error ? error.name : 'UnknownError' }))
    }
    return undefined
  }
}

export async function getOrGenerateVocabularyImage(userId: string, input: VocabularyInsightInput): Promise<{ base64: string; mimeType: string }> {
  const key = cacheKey(userId, input)
  const cached = await readCachedImage(key)
  if (cached) return cached

  const existing = inFlightImages.get(key)
  if (existing) {
    console.info(JSON.stringify({ event: 'vocabulary_image_request_coalesced' }))
    return existing
  }

  console.info(JSON.stringify({ event: 'vocabulary_image_cache_miss' }))
  const generation = (async () => {
    const image = await generateVocabularyImage(input)
    try {
      await mkdir(cacheDirectory, { recursive: true })
      const temporaryPath = `${cacheDirectory}/${key}.${process.pid}.tmp`
      await writeFile(temporaryPath, Buffer.from(image.base64, 'base64'), { mode: 0o600 })
      await rename(temporaryPath, `${cacheDirectory}/${key}.png`)
    } catch (error) {
      console.warn(JSON.stringify({ event: 'vocabulary_image_cache_write_failed', errorName: error instanceof Error ? error.name : 'UnknownError' }))
    }
    return image
  })()
  inFlightImages.set(key, generation)
  try {
    return await generation
  } finally {
    if (inFlightImages.get(key) === generation) inFlightImages.delete(key)
  }
}
