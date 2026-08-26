import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { languageNames, type LanguageCode } from '../services/openai.js'
import { recordLearningActivity } from '../services/learningActivity.js'

interface VocabularyRow {
  vocabulary_id: string
  favorite_id: string | null
  language_code: string
  word: string
  meaning: string
  context_meaning: string | null
  cefr_level: string | null
  etymology: string | null
  memory_tip: string | null
  example_sentence: string | null
  saved_at: string
  mastery_level: number
  mastery_score: string
  total_attempts: number
  correct_count: number
  incorrect_count: number
  correct_streak: number
  incorrect_streak: number
  last_reviewed_at: string | null
  next_review_at: string
  is_due: boolean
  next_review_in_days: number
}

interface VocabularyInput {
  languageCode: LanguageCode
  word: string
  meaning: string
  contextMeaning: string
  cefrLevel: string | null
  etymology: string | null
  memoryTip: string | null
  exampleSentence: string | null
}

const cefrLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
export const vocabulariesRouter = Router()

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function parseVocabularyInput(body: Record<string, unknown>): VocabularyInput | undefined {
  const languageCode = body.languageCode as LanguageCode
  const rawWord = typeof body.word === 'string' ? body.word.trim() : ''
  const word = languageCode === 'en' || languageCode === 'fr' ? rawWord.toLocaleLowerCase() : rawWord
  const meaning = typeof body.meaning === 'string' ? body.meaning.trim() : ''
  const contextMeaning = typeof body.contextMeaning === 'string' ? body.contextMeaning.trim() : ''
  const cefrLevel = optionalText(body.cefrLevel)?.toUpperCase() ?? null
  if (!(languageCode in languageNames) || !word || !meaning || word.length > 255) return undefined
  if (cefrLevel && !cefrLevels.has(cefrLevel)) return undefined
  return { languageCode, word, meaning, contextMeaning, cefrLevel, etymology: optionalText(body.etymology), memoryTip: optionalText(body.memoryTip), exampleSentence: optionalText(body.exampleSentence) }
}

function serializeVocabulary(row: VocabularyRow) {
  return {
    vocabularyId: row.vocabulary_id,
    favoriteId: row.favorite_id,
    isFavorite: Boolean(row.favorite_id),
    languageCode: row.language_code,
    word: row.word,
    meaning: row.meaning,
    contextMeaning: row.context_meaning,
    cefrLevel: row.cefr_level,
    etymology: row.etymology,
    memoryTip: row.memory_tip,
    exampleSentence: row.example_sentence,
    savedAt: row.saved_at,
    progress: {
      masteryLevel: row.mastery_level,
      masteryScore: Number(row.mastery_score),
      totalAttempts: row.total_attempts,
      correctCount: row.correct_count,
      incorrectCount: row.incorrect_count,
      correctStreak: row.correct_streak,
      incorrectStreak: row.incorrect_streak,
      lastReviewedAt: row.last_reviewed_at,
      nextReviewAt: row.next_review_at,
      isDue: row.is_due,
      nextReviewInDays: row.next_review_in_days,
    },
  }
}

const vocabularySelect = `SELECT v.id AS vocabulary_id, f.id AS favorite_id, v.language_code, v.word,
  v.meaning, v.context_meaning, v.cefr_level, v.etymology, v.memory_tip, v.example_sentence,
  v.created_at AS saved_at, p.mastery_level, p.mastery_score, p.total_attempts,
  p.correct_count, p.incorrect_count, p.correct_streak, p.incorrect_streak,
  p.last_reviewed_at, p.next_review_at,
  (p.total_attempts > 0 AND p.next_review_at <= CURRENT_TIMESTAMP) AS is_due,
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (p.next_review_at - CURRENT_TIMESTAMP)) / 86400))::integer AS next_review_in_days
  FROM vocabularies v
  JOIN vocabulary_progress p ON p.user_id = v.user_id AND p.vocabulary_id = v.id
  LEFT JOIN favorite_vocabularies f ON f.vocabulary_id = v.id`

vocabulariesRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const onlyFavorites = request.query.favorite === 'true'
    const result = await pool.query<VocabularyRow>(
      `${vocabularySelect}
       WHERE v.user_id = $1 AND v.archived_at IS NULL ${onlyFavorites ? 'AND f.id IS NOT NULL' : ''}
       ORDER BY v.created_at DESC`,
      [request.auth!.userId],
    )
    response.json({ vocabularies: result.rows.map(serializeVocabulary) })
  } catch (error) { next(error) }
})

vocabulariesRouter.post('/', requireAuth, async (request, response, next) => {
  const vocabulary = parseVocabularyInput(request.body as Record<string, unknown>)
  if (!vocabulary) {
    response.status(400).json({ status: 'error', message: '저장할 단어 정보가 올바르지 않습니다.' })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const saved = await client.query<{ id: string }>(
      `INSERT INTO vocabularies
         (user_id, language_code, word, meaning, context_meaning, cefr_level, etymology, memory_tip, example_sentence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, language_code, word) DO UPDATE SET
         meaning=EXCLUDED.meaning, context_meaning=EXCLUDED.context_meaning,
         cefr_level=COALESCE(EXCLUDED.cefr_level,vocabularies.cefr_level),
         etymology=COALESCE(EXCLUDED.etymology,vocabularies.etymology),
         memory_tip=COALESCE(EXCLUDED.memory_tip,vocabularies.memory_tip),
         example_sentence=COALESCE(EXCLUDED.example_sentence,vocabularies.example_sentence), archived_at=NULL
       RETURNING id`,
      [request.auth!.userId, vocabulary.languageCode, vocabulary.word, vocabulary.meaning,
        vocabulary.contextMeaning || null, vocabulary.cefrLevel, vocabulary.etymology, vocabulary.memoryTip, vocabulary.exampleSentence],
    )
    const vocabularyId = saved.rows[0].id
    await client.query(`INSERT INTO vocabulary_progress (user_id,vocabulary_id) VALUES ($1,$2) ON CONFLICT (user_id,vocabulary_id) DO NOTHING`, [request.auth!.userId, vocabularyId])
    const result = await client.query<VocabularyRow>(`${vocabularySelect} WHERE v.id=$1 AND v.user_id=$2`, [vocabularyId, request.auth!.userId])
    await recordLearningActivity(client, request.auth!.userId, 'vocabulary')
    await client.query('COMMIT')
    response.status(201).json({ vocabulary: serializeVocabulary(result.rows[0]) })
  } catch (error) {
    await client.query('ROLLBACK'); next(error)
  } finally { client.release() }
})

vocabulariesRouter.delete('/:vocabularyId', requireAuth, async (request, response, next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(`UPDATE vocabularies SET archived_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2 AND archived_at IS NULL RETURNING id`, [request.params.vocabularyId, request.auth!.userId])
    if (!result.rowCount) {
      await client.query('ROLLBACK'); response.status(404).json({ status: 'error', message: '단어를 찾을 수 없습니다.' }); return
    }
    await client.query(`DELETE FROM favorite_vocabularies WHERE vocabulary_id=$1`, [request.params.vocabularyId])
    await client.query('COMMIT'); response.status(204).send()
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})

vocabulariesRouter.post('/:vocabularyId/favorite', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO favorite_vocabularies (vocabulary_id)
       SELECT id FROM vocabularies WHERE id=$1 AND user_id=$2 AND archived_at IS NULL
       ON CONFLICT (vocabulary_id) DO NOTHING RETURNING id`,
      [request.params.vocabularyId, request.auth!.userId],
    )
    if (!result.rowCount) {
      const owned = await pool.query(`SELECT 1 FROM vocabularies WHERE id=$1 AND user_id=$2 AND archived_at IS NULL`, [request.params.vocabularyId, request.auth!.userId])
      if (!owned.rowCount) { response.status(404).json({ status: 'error', message: '단어를 찾을 수 없습니다.' }); return }
    }
    response.status(204).send()
  } catch (error) { next(error) }
})

vocabulariesRouter.delete('/:vocabularyId/favorite', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM favorite_vocabularies f USING vocabularies v
       WHERE f.vocabulary_id=v.id AND v.id=$1 AND v.user_id=$2 RETURNING f.id`,
      [request.params.vocabularyId, request.auth!.userId],
    )
    if (!result.rowCount) { response.status(404).json({ status: 'error', message: '즐겨찾기한 단어를 찾을 수 없습니다.' }); return }
    response.status(204).send()
  } catch (error) { next(error) }
})
