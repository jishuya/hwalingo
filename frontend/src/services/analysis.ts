export const languageOptions = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: '영어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'fr', label: '프랑스어' },
] as const

export type LanguageCode = typeof languageOptions[number]['code']

export interface AnalysisRequest {
  text: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
}

export interface SentenceAnalysis {
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  detectedSourceLanguage: string
  sourceText: string
  targetSentence: string
  naturalSourceMeaning: string
  backgroundKnowledge: string
  keyExpressions: Array<{ text: string; meaning: string }>
  chunks: Array<{ targetText: string; sourceMeaning: string }>
  paraphrases: Array<{
    level: 'beginner' | 'intermediate' | 'advanced'
    targetText: string
    sourceMeaning: string
  }>
  vocabulary: Array<{
    word: string
    partOfSpeech: string
    level: string
    basicMeaning: string
    contextualMeaning: string
    etymology: string
    memoryTip: string
  }>
  warnings: string[]
}

export async function analyzeSentence(request: AnalysisRequest): Promise<SentenceAnalysis> {
  const response = await fetch('/api/analysis', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  })
  const result = await response.json().catch(() => ({})) as { analysis?: SentenceAnalysis; message?: string }
  if (!response.ok || !result.analysis) throw new Error(result.message ?? 'AI 분석을 완료하지 못했습니다.')
  return result.analysis
}
