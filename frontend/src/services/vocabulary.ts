import type { LanguageCode } from './analysis'

export interface Vocabulary {
  vocabularyId: string
  favoriteId: string | null
  isFavorite: boolean
  languageCode: LanguageCode
  word: string
  meaning: string
  contextMeaning: string | null
  cefrLevel: string | null
  etymology: string | null
  memoryTip: string | null
  exampleSentence: string | null
  savedAt: string
  progress: {
    masteryLevel: number; masteryScore: number; totalAttempts: number; correctCount: number
    incorrectCount: number; correctStreak: number; incorrectStreak: number
    lastReviewedAt: string | null; nextReviewAt: string
    isDue: boolean; nextReviewInDays: number
  }
}

export interface SaveVocabularyInput {
  languageCode: LanguageCode
  word: string
  meaning: string
  contextMeaning: string
  cefrLevel: string
  etymology: string
  memoryTip: string
  exampleSentence?: string
}

interface ErrorResponse { message?: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, credentials: 'include', headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ErrorResponse
    throw new Error(error.message ?? '단어장 요청을 처리하지 못했습니다.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export async function getVocabularies(favoritesOnly = false): Promise<Vocabulary[]> {
  const result = await request<{ vocabularies: Vocabulary[] }>(`/api/vocabularies${favoritesOnly ? '?favorite=true' : ''}`)
  return result.vocabularies
}

export async function saveVocabulary(input: SaveVocabularyInput): Promise<Vocabulary> {
  const result = await request<{ vocabulary: Vocabulary }>('/api/vocabularies', { method: 'POST', body: JSON.stringify(input) })
  return result.vocabulary
}

export function deleteVocabulary(vocabularyId: string): Promise<void> {
  return request(`/api/vocabularies/${vocabularyId}`, { method: 'DELETE' })
}

export function setVocabularyFavorite(vocabularyId: string, favorite: boolean): Promise<void> {
  return request(`/api/vocabularies/${vocabularyId}/favorite`, { method: favorite ? 'POST' : 'DELETE' })
}
