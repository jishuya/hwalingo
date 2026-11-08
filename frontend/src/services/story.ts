import { apiFetch } from './apiFetch'
export class StoryRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'StoryRequestError'
    this.status = status
  }
}

export type StoryGenre = 'daily' | 'adventure' | 'fantasy' | 'mystery' | 'comedy' | 'business' | 'romance'
export type StoryLength = 'short' | 'medium' | 'long'
export type StoryDifficulty = 'easy' | 'normal' | 'hard'

export interface GeneratedStory {
  title: string
  story: string
  translation: string
  segments: Array<{ text: string; vocabularyId: string | null }>
  vocabularyUsages: Array<{ vocabularyId: string; word: string; meaning: string; pronunciation?: string; usedForm: string; sentence: string }>
}

export interface CreateStoryInput {
  vocabularyIds: string[]
  genre: StoryGenre
  length: StoryLength
  difficulty: StoryDifficulty
  forceRegenerate?: boolean
}

export async function createStory(input: CreateStoryInput): Promise<GeneratedStory> {
  const response = await apiFetch('/api/stories', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  const result = await response.json().catch(() => ({})) as { story?: GeneratedStory; message?: string }
  if (!response.ok || !result.story) throw new StoryRequestError(result.message ?? '스토리를 만들지 못했습니다.', response.status)
  return result.story
}

export async function getStoryTranslation(input: { story: string; languageCode: string }): Promise<string> {
  const response = await apiFetch('/api/stories/translation', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => ({})) as { translation?: string; message?: string }
  if (!response.ok || !result.translation) throw new StoryRequestError(result.message ?? '스토리 번역을 불러오지 못했습니다.', response.status)
  if (!isKoreanStoryTranslation(result.translation)) throw new Error('한국어 번역을 불러오지 못했어요. 다시 시도해주세요.')
  return result.translation
}

export function isKoreanStoryTranslation(value: unknown): value is string {
  return typeof value === 'string' && /[가-힣]/u.test(value)
    && !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)
}
