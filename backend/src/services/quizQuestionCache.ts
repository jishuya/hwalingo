import { AI_RULES } from '../config/aiRules.js'
import { readAIResponseCache, writeAIResponseCache } from './aiResponseCache.js'
import { generateAdvancedQuizQuestions, type AdvancedQuestionRequest, type GeneratedQuestion } from './quizAI.js'

const operation = 'advanced_quiz_question_v1'

function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[.!?。！？]+$/u, '').replace(/\s+/g, ' ')
}

function isValidQuestion(question: GeneratedQuestion, request: AdvancedQuestionRequest): boolean {
  if (question.vocabularyId !== request.vocabularyId || question.questionType !== request.questionType) return false
  if (!question.prompt.trim() || !question.correctAnswer.trim()) return false
  if (question.questionType === 'context') {
    return (question.prompt.match(/_____/g)?.length ?? 0) === 1
      && normalizeAnswer(question.correctAnswer) === normalizeAnswer(request.word)
  }
  return normalizeAnswer(question.correctAnswer).includes(normalizeAnswer(request.word))
}

export async function getCachedAdvancedQuizQuestions(userId: string, requests: AdvancedQuestionRequest[]): Promise<Map<string, GeneratedQuestion>> {
  const entries = await Promise.all(requests.map(async request => {
    const question = await readAIResponseCache<GeneratedQuestion>({ userId, operation, keyParts: request })
    return question && isValidQuestion(question, request) ? [request.vocabularyId, question] as const : undefined
  }))
  return new Map(entries.filter((entry): entry is readonly [string, GeneratedQuestion] => Boolean(entry)))
}

export async function warmAdvancedQuizQuestionCache(userId: string, requests: AdvancedQuestionRequest[]): Promise<void> {
  if (!requests.length) return
  try {
    const generated = await generateAdvancedQuizQuestions(requests)
    const requestedById = new Map(requests.map(request => [request.vocabularyId, request]))
    await Promise.all(generated.map(async question => {
      const request = requestedById.get(question.vocabularyId)
      if (!request || !isValidQuestion(question, request)) return
      await writeAIResponseCache({
        userId,
        operation,
        keyParts: request,
        value: question,
        ttlMs: AI_RULES.cache.advancedQuizTtlMs,
      })
    }))
  } catch (error) {
    console.error('AI quiz cache warmup failed; future sessions will keep deterministic questions', error)
  }
}
