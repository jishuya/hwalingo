export type QuestionType = 'multiple_choice' | 'recall' | 'context' | 'translation'

export interface QuizItem {
  id: string
  retryOfItemId: string | null
  position: number
  selectionGroup: 'due' | 'new' | 'mastered' | 'weak' | 'fallback'
  questionType: QuestionType
  prompt: string
  choices: string[]
  result: 'correct' | 'incorrect' | null
  answeredAt: string | null
  word: string
  reviewIntervalMinutes: number | null
  cefrLevel: string | null
  languageCode: string
  meaning: string
  contextMeaning: string | null
  exampleSentence: string | null
  exampleTranslation: string | null
  etymology: string | null
  memoryTip: string | null
  correctAnswer?: string
  explanation?: string | null
  generationSource: 'deterministic' | 'ai'
}

export interface QuizSession {
  id: string
  status: 'active' | 'completed' | 'abandoned'
  totalCount: number
  correctCount: number
  earnedXp: number
  startedAt: string
  completedAt: string | null
  items: QuizItem[]
}

export interface AnswerResult {
  isRetry?: boolean
  correct: boolean
  correctAnswer: string
  mastery: { before: number; after: number }
  nextReviewAt: string
  xpEarned: number
  questionExplanation: string | null
  growth: {
    totalXp: number
    level: number
    currentLevelXp: number
    nextLevelXp: number | null
    progressPercent: number
    hwarangGrade: { name: string; step: number; maxStep: number; index: number }
    leveledUp: boolean
    gradeChanged: boolean
  }
}

export interface VocabularyDeepAnalysis {
  synonyms: Array<{ word: string; meaning: string }>
  antonyms: Array<{ word: string; meaning: string }>
  nuance: string
  usageTip: string
}

interface ErrorResponse { message?: string; code?: string }

export class QuizRequestError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'QuizRequestError'
    this.code = code
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ErrorResponse
    throw new QuizRequestError(error.message ?? '테스트 요청을 처리하지 못했습니다.', error.code)
  }
  return response.json() as Promise<T>
}

export async function createQuizSession(count?: number, mode: 'standard' | 'incorrect' = 'standard'): Promise<QuizSession> {
  const result = await request<{ session: QuizSession }>('/api/quizzes/sessions', { method: 'POST', body: JSON.stringify({ count, mode }) })
  return result.session
}

export async function getQuizSession(sessionId: string): Promise<QuizSession> {
  const result = await request<{ session: QuizSession }>(`/api/quizzes/sessions/${sessionId}`)
  return result.session
}

export function submitQuizAnswer(sessionId: string, itemId: string, correct: boolean, responseTimeMs: number): Promise<AnswerResult> {
  return request(`/api/quizzes/sessions/${sessionId}/items/${itemId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ selfReportedCorrect: correct, responseTimeMs, usedHint: false }),
  })
}

export async function getVocabularyDeepAnalysis(sessionId: string, itemId: string): Promise<VocabularyDeepAnalysis> {
  const result = await request<{ analysis: VocabularyDeepAnalysis }>(`/api/quizzes/sessions/${sessionId}/items/${itemId}/deep-analysis`, { method: 'POST' })
  return result.analysis
}

export async function generateVocabularyImage(sessionId: string, itemId: string): Promise<{ imageDataUrl: string; explanation: string }> {
  const result = await request<{ imageDataUrl: string; explanation: string }>(`/api/quizzes/sessions/${sessionId}/items/${itemId}/image`, { method: 'POST' })
  return result
}
