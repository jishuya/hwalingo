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
  inputLanguage: LanguageCode
  learningLanguage: LanguageCode
}

export interface SentenceAnalysis {
  inputLanguage: LanguageCode
  learningLanguage: LanguageCode
  detectedSourceLanguage: string
  backgroundKnowledge: string
  sentences: AnalyzedSentence[]
  warnings: string[]
}

export interface AnalyzedSentence {
  inputText: string
  learningSentence: string
  koreanTranslation: string
  englishTranslation: string
  keyExpressions: Array<{ text: string; meaning: string }>
  chunks: Array<{ targetText: string; sourceMeaning: string; role: 'subject' | 'verb' | 'other' }>
  paraphrases: Array<{ level: 'B1' | 'B2' | 'C1' | 'C2'; targetText: string; sourceMeaning: string }>
  vocabulary: Array<{ word: string; partOfSpeech: string; level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; basicMeaning: string; contextualMeaning: string; etymology: string; memoryTip: string; exampleSentence: string; exampleMeaning: string }>
}

export type SentenceParaphrase = AnalyzedSentence['paraphrases'][number]
export type VocabularyAnalysis = AnalyzedSentence['vocabulary'][number]

export async function analyzeSentence(request: AnalysisRequest, signal?: AbortSignal): Promise<SentenceAnalysis> {
  const response = await fetch('/api/analysis', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal,
  })
  const result = await response.json().catch(() => ({})) as { analysis?: SentenceAnalysis; message?: string }
  if (!response.ok || !result.analysis) throw new Error(result.message ?? 'AI 분석을 완료하지 못했습니다.')
  return result.analysis
}

export async function getSentenceParaphrases(input: Pick<AnalysisRequest, 'inputLanguage' | 'learningLanguage'> & { learningSentence: string }, signal?: AbortSignal): Promise<SentenceParaphrase[]> {
  const response = await fetch('/api/analysis/paraphrases', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  const result = await response.json().catch(() => ({})) as { paraphrases?: SentenceParaphrase[]; message?: string }
  if (!response.ok || !result.paraphrases) throw new Error(result.message ?? '패러프레이징을 불러오지 못했습니다.')
  return result.paraphrases
}

export async function getSentenceVocabulary(input: Pick<AnalysisRequest, 'inputLanguage' | 'learningLanguage'> & {
  sentences: Array<Pick<AnalyzedSentence, 'inputText' | 'learningSentence'>>
}, signal?: AbortSignal): Promise<VocabularyAnalysis[][]> {
  const response = await fetch('/api/analysis/vocabulary', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  const result = await response.json().catch(() => ({})) as { vocabularies?: VocabularyAnalysis[][]; message?: string }
  if (!response.ok || !result.vocabularies) throw new Error(result.message ?? '상세 어휘를 불러오지 못했습니다.')
  return result.vocabularies
}
