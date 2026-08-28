export type StoryGenre = 'daily' | 'adventure' | 'fantasy' | 'mystery' | 'comedy'
export type StoryLength = 'short' | 'medium' | 'long'
export type StoryDifficulty = 'easy' | 'normal' | 'hard'

export interface GeneratedStory {
  title: string
  story: string
  translation: string
  segments: Array<{ text: string; vocabularyId: string | null }>
  vocabularyUsages: Array<{ vocabularyId: string; word: string; meaning: string; usedForm: string; sentence: string }>
}

export interface CreateStoryInput {
  vocabularyIds: string[]
  genre: StoryGenre
  length: StoryLength
  difficulty: StoryDifficulty
  forceRegenerate?: boolean
}

export async function createStory(input: CreateStoryInput): Promise<GeneratedStory> {
  const response = await fetch('/api/stories', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  const result = await response.json().catch(() => ({})) as { story?: GeneratedStory; message?: string }
  if (!response.ok || !result.story) throw new Error(result.message ?? '스토리를 만들지 못했습니다.')
  return result.story
}
