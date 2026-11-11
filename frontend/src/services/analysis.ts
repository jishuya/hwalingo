import { apiFetch } from './apiFetch'
export const languageOptions = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: '영어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'fr', label: '프랑스어' },
  { code: 'de', label: '독일어' },
  { code: 'es', label: '스페인어' },
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
  chunks: Array<{ targetText: string; sourceMeaning: string }>
  paraphrases: Array<{ level: 'B1' | 'B2' | 'C1' | 'C2'; targetText: string; sourceMeaning: string }>
  vocabulary: Array<{ word: string; pronunciation?: string; partOfSpeech: string; level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; basicMeaning: string; contextualMeaning: string; etymology: string; memoryTip: string; exampleSentence: string; exampleMeaning: string }>
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
      }, []).map(chunk => ({
        ...chunk,
        sourceMeaning: chunk.sourceMeaning.trim().replace(/[.。．｡]+$/u, '').trimEnd(),
      })),
    })),
  }
}

export interface AnalysisJob {
  id: string
  request: AnalysisRequest
  status: 'queued' | 'running' | 'completed' | 'failed'
  analysis: SentenceAnalysis | null
  message: string | null
}

async function readJobResponse(response: Response): Promise<AnalysisJob> {
  const result = await response.json().catch(() => ({})) as { job?: AnalysisJob; message?: string }
  if (!response.ok || !result.job) throw new Error(result.message ?? (response.status === 504
    ? '서버 응답 시간이 초과되었습니다. 잠시 후 이전 분석을 이어서 확인해 주세요.'
    : '분석 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'))
  return result.job
}

export async function getLatestAnalysisJob(signal?: AbortSignal): Promise<AnalysisJob | null> {
  const response = await apiFetch('/api/analysis/jobs/latest', { credentials: 'include', cache: 'no-store', signal })
  if (!response.ok) throw new Error('이전 분석을 불러오지 못했습니다.')
  const result = await response.json() as { job: AnalysisJob | null }
  return result.job
}

function waitForPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 2_000)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function analyzeSentence(request: AnalysisRequest, signal?: AbortSignal, resumeJobId?: string): Promise<SentenceAnalysis> {
  let job = await readJobResponse(await apiFetch(resumeJobId ? `/api/analysis/jobs/${encodeURIComponent(resumeJobId)}` : '/api/analysis', {
    method: resumeJobId ? 'GET' : 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: resumeJobId ? undefined : JSON.stringify(request), signal,
  }))
  let failures = 0
  while (job.status === 'queued' || job.status === 'running') {
    await waitForPoll(signal)
    try {
      const response = await apiFetch(`/api/analysis/jobs/${encodeURIComponent(job.id)}`, { credentials: 'include', cache: 'no-store', signal })
      // Authentication and missing jobs require user action; do not retry these.
      if (response.status >= 400 && response.status < 500) return Promise.reject(new Error((await response.json()).message ?? '분석 상태를 확인하지 못했습니다.'))
      job = await readJobResponse(response)
      failures = 0
    } catch (error) {
      if (signal?.aborted || ++failures >= 3) throw error
    }
  }
  if (job.status !== 'completed' || !job.analysis) throw new Error(job.message ?? 'AI 분석을 완료하지 못했습니다. 다시 분석해 주세요.')
  return attachStandalonePunctuation(job.analysis)
}

export async function getSentenceParaphrases(input: Pick<AnalysisRequest, 'inputLanguage' | 'learningLanguage'> & { learningSentence: string }, signal?: AbortSignal): Promise<SentenceParaphrase[]> {
  const response = await apiFetch('/api/analysis/paraphrases', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  const result = await response.json().catch(() => ({})) as { paraphrases?: SentenceParaphrase[]; message?: string }
  if (!response.ok || !result.paraphrases) throw new Error(result.message ?? '패러프레이징을 불러오지 못했습니다.')
  return result.paraphrases
}

export async function getSentenceVocabulary(input: Pick<AnalysisRequest, 'inputLanguage' | 'learningLanguage'> & {
  sentences: Array<Pick<AnalyzedSentence, 'inputText' | 'learningSentence'>>
}, signal?: AbortSignal): Promise<VocabularyAnalysis[][]> {
  const response = await apiFetch('/api/analysis/vocabulary', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  const result = await response.json().catch(() => ({})) as { vocabularies?: VocabularyAnalysis[][]; message?: string }
  if (!response.ok || !result.vocabularies) throw new Error(result.message ?? '상세 어휘를 불러오지 못했습니다.')
  return result.vocabularies.map(items => items.filter(item => ['B1', 'B2', 'C1', 'C2'].includes(item.level)))
}
