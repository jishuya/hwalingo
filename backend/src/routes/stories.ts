import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { generateStory, generateStoryTranslation, type StoryDifficulty, type StoryGenre, type StoryLength, type StoryVocabulary } from '../services/storyAI.js'
import { languageNames, type LanguageCode } from '../services/openai.js'
import { AI_RULES } from '../config/aiRules.js'
import { readAIResponseCache, writeAIResponseCache } from '../services/aiResponseCache.js'

export const storiesRouter = Router()
const genres = new Set<StoryGenre>(['daily', 'adventure', 'fantasy', 'mystery', 'comedy'])
const lengths = new Set<StoryLength>(['short', 'medium', 'long'])
const difficulties = new Set<StoryDifficulty>(['easy', 'normal', 'hard'])

interface StoryVocabularyRow extends StoryVocabulary { language_code: LanguageCode }

storiesRouter.post('/translation', requireAuth, async (request, response, next) => {
  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
  try {
    const story = typeof request.body.story === 'string' ? request.body.story.trim() : ''
    const languageCode = request.body.languageCode as LanguageCode
    if (!story || story.length > 5_000) {
      response.status(400).json({ message: '번역할 스토리가 올바르지 않습니다.' }); return
    }
    if (!(languageCode in languageNames)) {
      response.status(400).json({ message: '스토리 언어가 올바르지 않습니다.' }); return
    }
    const translation = await readAIResponseCache<string>({
      userId: request.auth!.userId,
      operation: 'vocabulary_story_translation_v1',
      keyParts: { story, languageCode },
    }) ?? await generateStoryTranslation({ story, languageCode }, abortController.signal)
    await writeAIResponseCache({
      userId: request.auth!.userId,
      operation: 'vocabulary_story_translation_v1',
      keyParts: { story, languageCode },
      value: translation,
      ttlMs: AI_RULES.cache.storyTranslationTtlMs,
    })
    response.json({ translation })
  } catch (error) { next(error) }
})

storiesRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const ids = Array.isArray(request.body.vocabularyIds) ? [...new Set(request.body.vocabularyIds.filter((id: unknown): id is string => typeof id === 'string' && /^\d+$/.test(id)))] : []
    const genre = request.body.genre as StoryGenre
    const length = request.body.length as StoryLength
    const difficulty = request.body.difficulty as StoryDifficulty
    const forceRegenerate = request.body.forceRegenerate === true
    if (!ids.length || ids.length > 10) {
      response.status(400).json({ message: '단어를 1개 이상 10개 이하로 선택해주세요.' }); return
    }
    if (!genres.has(genre) || !lengths.has(length) || !difficulties.has(difficulty)) {
      response.status(400).json({ message: '스토리 설정이 올바르지 않습니다.' }); return
    }
    const result = await pool.query<StoryVocabularyRow>(
      `SELECT id AS "vocabularyId", word, meaning, context_meaning AS "contextMeaning", cefr_level AS "cefrLevel", language_code
       FROM vocabularies WHERE user_id=$1 AND archived_at IS NULL AND id=ANY($2::bigint[])`,
      [request.auth!.userId, ids],
    )
    if (result.rows.length !== ids.length) {
      response.status(400).json({ message: '선택한 단어 중 사용할 수 없는 단어가 있습니다.' }); return
    }
    const languageCode = result.rows[0].language_code
    if (result.rows.some(word => word.language_code !== languageCode)) {
      response.status(400).json({ message: '같은 언어의 단어만 함께 선택해주세요.' }); return
    }
    const cacheIdentity = {
      userId: request.auth!.userId,
      operation: 'vocabulary_story_v3',
      keyParts: { vocabularyIds: [...ids].sort(), languageCode, genre, length, difficulty },
    }
    if (!forceRegenerate) {
      const cachedStory = await readAIResponseCache<Awaited<ReturnType<typeof generateStory>>>(cacheIdentity)
      if (cachedStory) {
        response.json({ story: cachedStory, source: 'cache' })
        return
      }
    }

    const story = await generateStory({ vocabularies: result.rows, languageCode, genre, length, difficulty })
    await Promise.all([
      writeAIResponseCache({ ...cacheIdentity, value: story, ttlMs: AI_RULES.cache.storyTtlMs }),
      pool.query(
        `INSERT INTO ai_stories
           (user_id, title, english_content, korean_translation, used_words, story_data,
            vocabulary_ids, language_code, genre, story_length, difficulty)
         VALUES ($1, $2, $3, $4, $5::text[], $6::jsonb, $7::bigint[], $8, $9, $10, $11)`,
        [request.auth!.userId, story.title, story.story, story.translation,
          result.rows.map(item => item.word), JSON.stringify(story), ids,
          languageCode, genre, length, difficulty],
      ),
    ])
    response.json({ story, source: 'generated' })
  } catch (error) { next(error) }
})
