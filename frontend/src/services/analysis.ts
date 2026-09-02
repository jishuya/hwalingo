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

const punctuationOnly = /^[\s\u200B-\u200D\u2060\uFEFF]*[,.，。、｡．]+[\s\u200B-\u200D\u2060\uFEFF]*$/u
const standaloneJapaneseParticle = /^(?:は|が|を|に|へ|で|と|も|の|から|まで|より|では|には|とは|にも|でも)$/u

function attachJapaneseParticles(chunks: AnalyzedSentence['chunks'], learningLanguage: LanguageCode) {
  if (learningLanguage !== 'ja') return chunks
  return chunks.reduce<AnalyzedSentence['chunks']>((normalized, chunk) => {
    const particle = chunk.targetText.trim()
    if (!normalized.length || !standaloneJapaneseParticle.test(particle)) {
      normalized.push(chunk)
      return normalized
    }
    const previous = normalized[normalized.length - 1]
    normalized[normalized.length - 1] = {
      ...previous,
      targetText: `${previous.targetText}${particle}`,
      sourceMeaning: `${previous.sourceMeaning}${chunk.sourceMeaning.trim().replace(/^~/u, '')}`,
    }
    return normalized
  }, [])
}

function attachStandalonePunctuation(analysis: SentenceAnalysis): SentenceAnalysis {
  return {
    ...analysis,
    sentences: analysis.sentences.map(sentence => ({
      ...sentence,
      chunks: attachJapaneseParticles(sentence.chunks, analysis.learningLanguage).reduce<AnalyzedSentence['chunks']>((chunks, chunk) => {
        if (chunks.length && punctuationOnly.test(chunk.targetText)) {
          const previous = chunks[chunks.length - 1]
          const punctuation = chunk.targetText.replace(/[^,.，。、｡．]/gu, '')
          chunks[chunks.length - 1] = { ...previous, targetText: `${previous.targetText}${punctuation}` }
        } else {
          chunks.push(chunk)
        }
        return chunks
      }, []),
    })),
  }
}

export async function analyzeSentence(request: AnalysisRequest, signal?: AbortSignal): Promise<SentenceAnalysis> {
  const response = await fetch('/api/analysis', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal,
  })
  const result = await response.json().catch(() => ({})) as { analysis?: SentenceAnalysis; message?: string }
  if (!response.ok || !result.analysis) throw new Error(result.message ?? 'AI 분석을 완료하지 못했습니다.')
  return attachStandalonePunctuation(result.analysis)
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
