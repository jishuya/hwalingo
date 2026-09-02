import { Router } from 'express'
import { pool } from '../config/database.js'
import { QUIZ_RULES, type QuestionType, type SelectionGroup } from '../config/quizRules.js'
import type { MasteryLevel } from '../config/learningRules.js'
import { calculateReviewOutcome, type VocabularyProgressState } from '../domain/learning/mastery.js'
import { questionTypeForLevel } from '../domain/learning/questionDifficulty.js'
import { selectTestCandidates, type TestCandidate } from '../domain/learning/testSelection.js'
import { calculateQuizXp } from '../domain/learning/xp.js'
import { calculateLevelProgress } from '../domain/learning/level.js'
import { hwarangGradeForLevel } from '../domain/learning/hwarangGrade.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { recordLearningActivity } from '../services/learningActivity.js'
import { generateVocabularyDeepAnalysis, type VocabularyInsightInput } from '../services/vocabularyInsightsAI.js'
import { getOrGenerateVocabularyImage } from '../services/vocabularyImageCache.js'
import { withAIResponseCache } from '../services/aiResponseCache.js'
import { AI_RULES } from '../config/aiRules.js'

interface CandidateRow {
  vocabulary_id: string
  word: string
  meaning: string
  example_sentence: string | null
  mastery_level: MasteryLevel
  mastery_score: string
  total_attempts: number
  correct_count: number
  incorrect_count: number
  correct_streak: number
  incorrect_streak: number
  last_reviewed_at: string | null
  next_review_at: string
  mastered_at: string | null
}

interface SessionItemRow {
  id: string
  session_id: string
  vocabulary_id: string
  position: number
  selection_group: SelectionGroup
  question_type: QuestionType
  prompt: string
  correct_answer: string
  acceptable_answers: string[]
  choices: string[]
  explanation: string | null
  generation_source: 'deterministic' | 'ai'
  result: 'correct' | 'incorrect' | null
  answered_at: string | null
  word: string
  cefr_level: string | null
  language_code: string
  meaning: string
  context_meaning: string | null
  example_sentence: string | null
  example_translation: string | null
  etymology: string | null
  memory_tip: string | null
}

export const quizzesRouter = Router()

type VocabularyInsightRow = VocabularyInsightInput

async function getVocabularyInsightRow(userId: string, sessionId: string, itemId: string): Promise<VocabularyInsightRow | undefined> {
  const result = await pool.query<VocabularyInsightRow>(
    `SELECT v.id AS vocabulary_id, v.word, v.meaning, v.context_meaning AS "contextMeaning",
            v.example_sentence AS "exampleSentence", v.language_code AS "languageCode"
     FROM quiz_session_items i
     JOIN quiz_sessions s ON s.id = i.session_id
     JOIN vocabularies v ON v.id = i.vocabulary_id
     WHERE i.id = $1 AND i.session_id = $2 AND s.user_id = $3 AND v.user_id = $3`,
    [itemId, sessionId, userId],
  )
  return result.rows[0]
}

function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[.!?。！？]+$/u, '').replace(/\s+/g, ' ')
}

function isCorrectAnswer(submitted: string, answers: string[]): boolean {
  const normalized = normalizeAnswer(submitted)
  return answers.flatMap(answer => answer.split(/[,;/\n]|\s+또는\s+/u)).map(normalizeAnswer).filter(Boolean).some(option => option === normalized)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function shuffled<T>(items: T[]): T[] {
  return items.map(value => ({ value, order: Math.random() })).sort((a, b) => a.order - b.order).map(item => item.value)
}

function buildQuestion(candidate: CandidateRow, allCandidates: CandidateRow[]) {
  const type = questionTypeForLevel(candidate.mastery_level, Boolean(candidate.example_sentence))
  if (type === 'multiple_choice') {
    const distractors = shuffled(allCandidates.filter(item => item.vocabulary_id !== candidate.vocabulary_id).map(item => item.meaning))
      .filter((meaning, index, meanings) => meaning !== candidate.meaning && meanings.indexOf(meaning) === index)
      .slice(0, QUIZ_RULES.choiceCount - 1)
    return {
      questionType: type,
      prompt: candidate.word,
      correctAnswer: candidate.meaning,
      choices: shuffled([candidate.meaning, ...distractors]),
      acceptableAnswers: [],
      explanation: null,
      generationSource: 'deterministic' as const,
    }
  }
  if (type === 'context' && candidate.example_sentence) {
    const blanked = candidate.example_sentence.replace(new RegExp(`\\b${escapeRegExp(candidate.word)}\\b`, 'iu'), '_____')
    if (blanked !== candidate.example_sentence) {
      return { questionType: type, prompt: blanked, correctAnswer: candidate.word, choices: [], acceptableAnswers: [], explanation: null, generationSource: 'deterministic' as const }
    }
  }
  return { questionType: 'recall' as const, prompt: `“${candidate.meaning}”에 해당하는 단어를 입력하세요.`, correctAnswer: candidate.word, choices: [], acceptableAnswers: [], explanation: null, generationSource: 'deterministic' as const }
}

async function getSession(userId: string, sessionId: string) {
  const sessionResult = await pool.query<{
    id: string; status: string; total_count: number; correct_count: number; earned_xp: number; started_at: string; completed_at: string | null
  }>(
    `SELECT id, status, total_count, correct_count, earned_xp, started_at, completed_at
     FROM quiz_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  )
  const session = sessionResult.rows[0]
  if (!session) return undefined
  const itemResult = await pool.query<SessionItemRow>(
    `SELECT i.id, i.session_id, i.vocabulary_id, i.position, i.selection_group,
            i.question_type, i.prompt, i.correct_answer, i.acceptable_answers, i.choices,
            i.explanation, i.generation_source, i.result, i.answered_at,
            v.word, v.cefr_level, v.language_code, v.meaning, v.context_meaning,
            v.example_sentence, v.example_translation, v.etymology, v.memory_tip
     FROM quiz_session_items i
     JOIN vocabularies v ON v.id = i.vocabulary_id
     WHERE i.session_id = $1 ORDER BY i.position`,
    [sessionId],
  )
  return {
    id: session.id,
    status: session.status,
    totalCount: session.total_count,
    correctCount: session.correct_count,
    earnedXp: session.earned_xp,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    items: itemResult.rows.map(item => ({
      id: item.id,
      position: item.position,
      selectionGroup: item.selection_group,
      questionType: item.question_type,
      prompt: item.prompt,
      choices: item.choices,
      result: item.result,
      answeredAt: item.answered_at,
      word: item.word,
      cefrLevel: item.cefr_level,
      languageCode: item.language_code,
      meaning: item.meaning,
      contextMeaning: item.context_meaning,
      exampleSentence: item.example_sentence,
      exampleTranslation: item.example_translation,
      etymology: item.etymology,
      memoryTip: item.memory_tip,
      generationSource: item.generation_source,
      ...(item.result ? { correctAnswer: item.correct_answer, explanation: item.explanation } : {}),
    })),
  }
}

quizzesRouter.post('/sessions', requireAuth, async (request, response, next) => {
  const client = await pool.connect()
  try {
    const configuredCountResult = await client.query<{ quiz_question_count: number }>(
      `SELECT quiz_question_count FROM user_settings WHERE user_id = $1`,
      [request.auth!.userId],
    )
    const configuredCount = configuredCountResult.rows[0]?.quiz_question_count ?? QUIZ_RULES.defaultQuestionCount
    const requested = Number.isInteger(request.body.count) ? Number(request.body.count) : configuredCount
    const requestedCount = Math.min(QUIZ_RULES.maxQuestionCount, Math.max(1, requested))
    const candidatesResult = await client.query<CandidateRow>(
      `SELECT v.id AS vocabulary_id, v.word, v.meaning, v.example_sentence,
              p.mastery_level, p.mastery_score, p.total_attempts, p.correct_count,
              p.incorrect_count, p.correct_streak, p.incorrect_streak,
              p.last_reviewed_at, p.next_review_at, p.mastered_at
       FROM vocabularies v
       JOIN vocabulary_progress p ON p.user_id = v.user_id AND p.vocabulary_id = v.id
       WHERE v.user_id = $1 AND v.archived_at IS NULL`,
      [request.auth!.userId],
    )
    if (!candidatesResult.rowCount) {
      response.status(409).json({ status: 'error', message: '테스트할 단어가 없습니다. 먼저 단어장에 단어를 저장해주세요.' })
      return
    }
    const rowsById = new Map(candidatesResult.rows.map(item => [item.vocabulary_id, item]))
    const candidates: TestCandidate[] = candidatesResult.rows.map(item => ({
      vocabularyId: item.vocabulary_id,
      masteryLevel: item.mastery_level,
      totalAttempts: item.total_attempts,
      correctCount: item.correct_count,
      incorrectCount: item.incorrect_count,
      nextReviewAt: new Date(item.next_review_at),
      lastReviewedAt: item.last_reviewed_at ? new Date(item.last_reviewed_at) : null,
    }))
    const selected = selectTestCandidates(candidates, requestedCount)
    await client.query('BEGIN')
    await client.query(`UPDATE quiz_sessions SET status = 'abandoned' WHERE user_id = $1 AND status = 'active'`, [request.auth!.userId])
    const sessionResult = await client.query<{ id: string }>(
      `INSERT INTO quiz_sessions (user_id, requested_count, total_count) VALUES ($1, $2, $3) RETURNING id`,
      [request.auth!.userId, requestedCount, selected.length],
    )
    const sessionId = sessionResult.rows[0].id
    for (const [index, selectedItem] of selected.entries()) {
      const candidate = rowsById.get(selectedItem.vocabularyId)!
      const question = buildQuestion(candidate, candidatesResult.rows)
      await client.query(
        `INSERT INTO quiz_session_items
           (session_id, vocabulary_id, position, selection_group, question_type, prompt,
            correct_answer, acceptable_answers, choices, explanation, generation_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
        [sessionId, candidate.vocabulary_id, index + 1, selectedItem.selectionGroup,
          question.questionType, question.prompt, question.correctAnswer, JSON.stringify(question.acceptableAnswers),
          JSON.stringify(question.choices), question.explanation, question.generationSource],
      )
    }
    await client.query('COMMIT')
    response.status(201).json({ session: await getSession(request.auth!.userId, sessionId) })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* transaction may not have started */ }
    next(error)
  } finally {
    client.release()
  }
})

quizzesRouter.get('/sessions/:sessionId', requireAuth, async (request, response, next) => {
  try {
    const session = await getSession(request.auth!.userId, String(request.params.sessionId))
    if (!session) {
      response.status(404).json({ status: 'error', message: '테스트 세션을 찾을 수 없습니다.' })
      return
    }
    response.json({ session })
  } catch (error) {
    next(error)
  }
})

quizzesRouter.post('/sessions/:sessionId/items/:itemId/deep-analysis', requireAuth, async (request, response, next) => {
  try {
    const vocabulary = await getVocabularyInsightRow(request.auth!.userId, String(request.params.sessionId), String(request.params.itemId))
    if (!vocabulary) {
      response.status(404).json({ status: 'error', message: '분석할 단어를 찾을 수 없습니다.' })
      return
    }
    const analysis = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'vocabulary_deep_analysis_v2',
      keyParts: vocabulary,
      ttlMs: AI_RULES.cache.vocabularyAnalysisTtlMs,
      generate: () => generateVocabularyDeepAnalysis(vocabulary),
    })
    response.json({ analysis })
  } catch (error) { next(error) }
})

quizzesRouter.post('/sessions/:sessionId/items/:itemId/image', requireAuth, async (request, response, next) => {
  try {
    const vocabulary = await getVocabularyInsightRow(request.auth!.userId, String(request.params.sessionId), String(request.params.itemId))
    if (!vocabulary) {
      response.status(404).json({ status: 'error', message: '그림을 만들 단어를 찾을 수 없습니다.' })
      return
    }
    const image = await getOrGenerateVocabularyImage(request.auth!.userId, vocabulary)
    response.json({ imageDataUrl: `data:${image.mimeType};base64,${image.base64}` })
  } catch (error) { next(error) }
})

quizzesRouter.post('/sessions/:sessionId/items/:itemId/answer', requireAuth, async (request, response, next) => {
  const submittedAnswer = typeof request.body.answer === 'string' ? request.body.answer.trim() : ''
  const selfReportedCorrect = typeof request.body.selfReportedCorrect === 'boolean' ? request.body.selfReportedCorrect : undefined
  const usedHint = request.body.usedHint === true
  const responseTimeMs = Number.isInteger(request.body.responseTimeMs) && request.body.responseTimeMs >= 0 ? request.body.responseTimeMs : null
  if (!submittedAnswer && selfReportedCorrect === undefined) {
    response.status(400).json({ status: 'error', message: '답을 입력해주세요.' })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const itemResult = await client.query<SessionItemRow>(
      `SELECT i.*, v.word, v.cefr_level
       FROM quiz_session_items i
       JOIN quiz_sessions s ON s.id = i.session_id
       JOIN vocabularies v ON v.id = i.vocabulary_id
       WHERE i.id = $1 AND i.session_id = $2 AND s.user_id = $3
       FOR UPDATE OF i`,
      [request.params.itemId, request.params.sessionId, request.auth!.userId],
    )
    const item = itemResult.rows[0]
    if (!item) {
      await client.query('ROLLBACK')
      response.status(404).json({ status: 'error', message: '문제를 찾을 수 없습니다.' })
      return
    }
    if (item.result) {
      await client.query('ROLLBACK')
      response.status(409).json({ status: 'error', message: '이미 답변한 문제입니다.' })
      return
    }
    const progressResult = await client.query<{
      mastery_level: MasteryLevel; mastery_score: string; total_attempts: number; correct_count: number;
      incorrect_count: number; correct_streak: number; incorrect_streak: number; mastered_at: string | null; next_review_at: string
    }>(
      `SELECT mastery_level, mastery_score, total_attempts, correct_count, incorrect_count,
              correct_streak, incorrect_streak, mastered_at, next_review_at
       FROM vocabulary_progress WHERE user_id = $1 AND vocabulary_id = $2 FOR UPDATE`,
      [request.auth!.userId, item.vocabulary_id],
    )
    const progress = progressResult.rows[0]
    const correct = selfReportedCorrect ?? isCorrectAnswer(submittedAnswer, [item.correct_answer, ...item.acceptable_answers])
    const reviewedAt = new Date()
    const state: VocabularyProgressState = {
      masteryLevel: progress.mastery_level,
      masteryScore: Number(progress.mastery_score),
      totalAttempts: progress.total_attempts,
      correctCount: progress.correct_count,
      incorrectCount: progress.incorrect_count,
      correctStreak: progress.correct_streak,
      incorrectStreak: progress.incorrect_streak,
      masteredAt: progress.mastered_at ? new Date(progress.mastered_at) : null,
    }
    const outcome = calculateReviewOutcome(state, correct, reviewedAt)
    const xpEarned = calculateQuizXp({
      correct,
      masteryLevelBefore: state.masteryLevel,
      totalAttemptsBefore: state.totalAttempts,
      nextReviewAtBefore: new Date(progress.next_review_at),
      reviewedAt,
      usedHint,
    })
    await client.query(`INSERT INTO user_progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [request.auth!.userId])
    const userProgressResult = await client.query<{ total_xp: string }>(
      `SELECT total_xp FROM user_progress WHERE user_id = $1 FOR UPDATE`, [request.auth!.userId],
    )
    const totalXpBefore = Number(userProgressResult.rows[0].total_xp)
    const growthBefore = calculateLevelProgress(totalXpBefore)
    await client.query(
      `UPDATE vocabulary_progress SET mastery_level = $1, mastery_score = $2, total_attempts = $3,
         correct_count = $4, incorrect_count = $5, correct_streak = $6, incorrect_streak = $7,
         last_reviewed_at = $8, next_review_at = $9, mastered_at = $10,
         algorithm_version = $11, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $12 AND vocabulary_id = $13`,
      [outcome.masteryLevel, outcome.masteryScore, outcome.totalAttempts, outcome.correctCount,
        outcome.incorrectCount, outcome.correctStreak, outcome.incorrectStreak, outcome.lastReviewedAt,
        outcome.nextReviewAt, outcome.masteredAt, outcome.algorithmVersion, request.auth!.userId, item.vocabulary_id],
    )
    await client.query(
      `UPDATE quiz_session_items SET result = $1, answered_at = $2 WHERE id = $3`,
      [correct ? 'correct' : 'incorrect', reviewedAt, item.id],
    )
    const quizResult = await client.query<{ id: string }>(
      `INSERT INTO quizzes
         (user_id, vocabulary_id, submitted_answer, result, used_hint, response_time_ms,
          answered_at, quiz_session_id, quiz_session_item_id, question_type,
          mastery_level_before, mastery_level_after, next_review_at, xp_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [request.auth!.userId, item.vocabulary_id, submittedAnswer || (correct ? 'self_reported_correct' : 'self_reported_incorrect'), correct ? 'correct' : 'incorrect',
        usedHint, responseTimeMs, reviewedAt, item.session_id, item.id, item.question_type,
        state.masteryLevel, outcome.masteryLevel, outcome.nextReviewAt, xpEarned],
    )
    if (xpEarned > 0) {
      await client.query(
        `INSERT INTO xp_events (user_id, quiz_id, event_type, amount, metadata)
         VALUES ($1, $2, 'quiz_review', $3, $4::jsonb)`,
        [request.auth!.userId, quizResult.rows[0].id, xpEarned, JSON.stringify({
          masteryLevel: state.masteryLevel,
          daysSinceScheduledReview: Math.max(0, Math.floor((reviewedAt.getTime() - new Date(progress.next_review_at).getTime()) / 86400000)),
          usedHint,
        })],
      )
      await client.query(
        `UPDATE user_progress SET total_xp = total_xp + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [xpEarned, request.auth!.userId],
      )
    }
    await client.query(
      `UPDATE quiz_sessions SET
         correct_count = correct_count + $1,
         earned_xp = earned_xp + $2
       WHERE id = $3`,
      [correct ? 1 : 0, xpEarned, item.session_id],
    )
    const remainingResult = await client.query<{ count: string }>(
      `SELECT count(*) FROM quiz_session_items WHERE session_id = $1 AND result IS NULL`, [item.session_id],
    )
    if (remainingResult.rows[0].count === '0') {
      await client.query(
        `UPDATE quiz_sessions SET status = 'completed', completed_at = $1 WHERE id = $2`,
        [reviewedAt, item.session_id],
      )
    }
    const totalXpAfter = totalXpBefore + xpEarned
    const growthAfter = calculateLevelProgress(totalXpAfter)
    const gradeBefore = hwarangGradeForLevel(growthBefore.level)
    const gradeAfter = hwarangGradeForLevel(growthAfter.level)
    await recordLearningActivity(client, request.auth!.userId, 'quiz', {
      earnedXp: xpEarned,
      reviewedWordCount: 1,
      occurredAt: reviewedAt,
    })
    await client.query('COMMIT')
    response.json({
      correct,
      correctAnswer: item.correct_answer,
      mastery: { before: state.masteryLevel, after: outcome.masteryLevel },
      nextReviewAt: outcome.nextReviewAt.toISOString(),
      xpEarned,
      questionExplanation: item.explanation,
      growth: {
        totalXp: totalXpAfter,
        level: growthAfter.level,
        currentLevelXp: growthAfter.currentLevelXp,
        nextLevelXp: growthAfter.nextLevelXp,
        progressPercent: growthAfter.progressPercent,
        hwarangGrade: gradeAfter,
        leveledUp: growthAfter.level > growthBefore.level,
        gradeChanged: gradeAfter.index !== gradeBefore.index,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})
