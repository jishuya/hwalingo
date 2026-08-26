import { Router } from 'express'
import { pool } from '../config/database.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { languageNames, type LanguageCode } from '../services/openai.js'
import { recordLearningActivity } from '../services/learningActivity.js'

interface FavoriteVocabularyRow {
  favorite_id: string
  vocabulary_id: string
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

  return {
    languageCode,
    word,
    meaning,
    contextMeaning,
    cefrLevel,
    etymology: optionalText(body.etymology),
    memoryTip: optionalText(body.memoryTip),
    exampleSentence: optionalText(body.exampleSentence),
  }
}

function serializeFavorite(row: FavoriteVocabularyRow) {
  return {
    favoriteId: row.favorite_id,
    vocabularyId: row.vocabulary_id,
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
    },
  }
}

vocabulariesRouter.get('/favorites', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query<FavoriteVocabularyRow>(
      `SELECT f.id AS favorite_id, v.id AS vocabulary_id, v.language_code, v.word,
              v.meaning, v.context_meaning, v.cefr_level, v.etymology,
              v.memory_tip, v.example_sentence, f.saved_at,
              p.mastery_level, p.mastery_score, p.total_attempts,
              p.correct_count, p.incorrect_count, p.correct_streak, p.incorrect_streak,
              p.last_reviewed_at, p.next_review_at
       FROM favorite_vocabularies f
       JOIN vocabularies v ON v.id = f.vocabulary_id
       JOIN vocabulary_progress p ON p.user_id = f.user_id AND p.vocabulary_id = f.vocabulary_id
       WHERE f.user_id = $1
       ORDER BY f.saved_at DESC`,
      [request.auth!.userId],
    )
    response.json({ vocabularies: result.rows.map(serializeFavorite) })
  } catch (error) {
    next(error)
  }
})

vocabulariesRouter.post('/favorites', requireAuth, async (request, response, next) => {
  const vocabulary = parseVocabularyInput(request.body as Record<string, unknown>)
  if (!vocabulary) {
    response.status(400).json({ status: 'error', message: '저장할 단어 정보가 올바르지 않습니다.' })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const vocabularyResult = await client.query<{ id: string }>(
      `INSERT INTO vocabularies
         (language_code, word, meaning, context_meaning, cefr_level, etymology, memory_tip, example_sentence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (language_code, word) DO UPDATE SET
         meaning = EXCLUDED.meaning,
         context_meaning = EXCLUDED.context_meaning,
         cefr_level = COALESCE(EXCLUDED.cefr_level, vocabularies.cefr_level),
         etymology = COALESCE(EXCLUDED.etymology, vocabularies.etymology),
         memory_tip = COALESCE(EXCLUDED.memory_tip, vocabularies.memory_tip),
         example_sentence = COALESCE(EXCLUDED.example_sentence, vocabularies.example_sentence)
       RETURNING id`,
      [vocabulary.languageCode, vocabulary.word, vocabulary.meaning, vocabulary.contextMeaning || null,
        vocabulary.cefrLevel, vocabulary.etymology, vocabulary.memoryTip, vocabulary.exampleSentence],
    )
    const vocabularyId = vocabularyResult.rows[0].id
    const favoriteResult = await client.query<{ favorite_id: string }>(
      `INSERT INTO favorite_vocabularies (user_id, vocabulary_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, vocabulary_id) DO UPDATE SET saved_at = favorite_vocabularies.saved_at
       RETURNING id AS favorite_id`,
      [request.auth!.userId, vocabularyId],
    )
    await client.query(
      `INSERT INTO vocabulary_progress (user_id, vocabulary_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, vocabulary_id) DO NOTHING`,
      [request.auth!.userId, vocabularyId],
    )
    const savedResult = await client.query<FavoriteVocabularyRow>(
      `SELECT f.id AS favorite_id, v.id AS vocabulary_id, v.language_code, v.word,
              v.meaning, v.context_meaning, v.cefr_level, v.etymology,
              v.memory_tip, v.example_sentence, f.saved_at,
              p.mastery_level, p.mastery_score, p.total_attempts,
              p.correct_count, p.incorrect_count, p.correct_streak, p.incorrect_streak,
              p.last_reviewed_at, p.next_review_at
       FROM favorite_vocabularies f
       JOIN vocabularies v ON v.id = f.vocabulary_id
       JOIN vocabulary_progress p ON p.user_id = f.user_id AND p.vocabulary_id = f.vocabulary_id
       WHERE f.id = $1 AND f.user_id = $2`,
      [favoriteResult.rows[0].favorite_id, request.auth!.userId],
    )
    await recordLearningActivity(client, request.auth!.userId, 'vocabulary')
    await client.query('COMMIT')
    response.status(201).json({ vocabulary: serializeFavorite(savedResult.rows[0]) })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

vocabulariesRouter.delete('/favorites/:favoriteId', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM favorite_vocabularies
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [request.params.favoriteId, request.auth!.userId],
    )
    if (!result.rowCount) {
      response.status(404).json({ status: 'error', message: '저장된 단어를 찾을 수 없습니다.' })
      return
    }
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})
