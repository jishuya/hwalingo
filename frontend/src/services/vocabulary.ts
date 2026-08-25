import type { LanguageCode } from './analysis'

export interface FavoriteVocabulary {
  favoriteId: string
  vocabularyId: string
  languageCode: LanguageCode
  word: string
  meaning: string
  contextMeaning: string | null
  cefrLevel: string | null
  etymology: string | null
  memoryTip: string | null
  exampleSentence: string | null
  savedAt: string
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
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ErrorResponse
    throw new Error(error.message ?? '단어장 요청을 처리하지 못했습니다.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export async function getFavoriteVocabularies(): Promise<FavoriteVocabulary[]> {
  const result = await request<{ vocabularies: FavoriteVocabulary[] }>('/api/vocabularies/favorites')
  return result.vocabularies
}

export async function saveFavoriteVocabulary(input: SaveVocabularyInput): Promise<FavoriteVocabulary> {
  const result = await request<{ vocabulary: FavoriteVocabulary }>('/api/vocabularies/favorites', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.vocabulary
}

export function deleteFavoriteVocabulary(favoriteId: string): Promise<void> {
  return request(`/api/vocabularies/favorites/${favoriteId}`, { method: 'DELETE' })
}
