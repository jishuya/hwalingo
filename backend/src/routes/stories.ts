import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { generateStory, type StoryDifficulty, type StoryGenre, type StoryLength, type StoryVocabulary } from '../services/storyAI.js'
import type { LanguageCode } from '../services/openai.js'

export const storiesRouter = Router()
const genres = new Set<StoryGenre>(['daily', 'adventure', 'fantasy', 'mystery', 'comedy'])
const lengths = new Set<StoryLength>(['short', 'medium', 'long'])
const difficulties = new Set<StoryDifficulty>(['easy', 'normal', 'hard'])

interface StoryVocabularyRow extends StoryVocabulary { language_code: LanguageCode }

storiesRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const ids = Array.isArray(request.body.vocabularyIds) ? [...new Set(request.body.vocabularyIds.filter((id: unknown): id is string => typeof id === 'string' && /^\d+$/.test(id)))] : []
    const genre = request.body.genre as StoryGenre
    const length = request.body.length as StoryLength
    const difficulty = request.body.difficulty as StoryDifficulty
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
    const story = await generateStory({ vocabularies: result.rows, languageCode, genre, length, difficulty })
    response.json({ story })
  } catch (error) { next(error) }
})
