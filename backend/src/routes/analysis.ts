import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { generateSentenceParaphrases, generateSentenceVocabulary, generateVocabularySummaries, languageNames, type LanguageCode, type VocabularySummary } from '../services/openai.js'
import { isKoreanExplanation } from '../services/vocabularyPresentation.js'
import { AI_RULES } from '../config/aiRules.js'
import { createAICacheKey, withAIResponseCache } from '../services/aiResponseCache.js'
import { createAnalysisJob, findAnalysisJob, presentAnalysisJob } from '../services/analysisJobs.js'

export const analysisRouter = Router()

type VocabularyJob = { id: string } & (
  | { status: 'running' }
  | { status: 'completed'; vocabularies: VocabularySummary[][] }
  | { status: 'failed'; error: unknown }
)
const vocabularyJobs = new Map<string, Map<string, VocabularyJob>>()

analysisRouter.get('/vocabulary/jobs/:id', requireAuth, (request, response, next) => {
  const job = [...(vocabularyJobs.get(request.auth!.userId)?.values() ?? [])].find(item => item.id === request.params.id)
  response.set('Cache-Control', 'no-store')
  if (!job) {
    response.status(404).json({ message: '어휘 작업이 만료되었습니다. 다시 시도해 주세요.' })
  } else if (job.status === 'running') {
    response.status(202).json({ jobId: job.id })
  } else if (job.status === 'completed') {
    response.json({ vocabularies: job.vocabularies })
  } else {
    next(job.error)
  }
})

analysisRouter.post('/paraphrases', requireAuth, async (request, response, next) => {
  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
  try {
    const inputLanguage = request.body.inputLanguage as LanguageCode
    const learningLanguage = request.body.learningLanguage as LanguageCode
    const learningSentence = typeof request.body.learningSentence === 'string' ? request.body.learningSentence.trim() : ''
    if (!learningSentence || learningSentence.length > 1_000) {
      response.status(400).json({ status: 'error', message: '패러프레이징할 문장이 올바르지 않습니다.' })
      return
    }
    if (!(inputLanguage in languageNames) || !(learningLanguage in languageNames)) {
      response.status(400).json({ status: 'error', message: '언어 설정이 올바르지 않습니다.' })
      return
    }
    const paraphrases = await withAIResponseCache({
      userId: request.auth!.userId,
      operation: 'sentence_paraphrases_v3',
      keyParts: { inputLanguage, learningLanguage, learningSentence },
      ttlMs: AI_RULES.cache.sentenceParaphrasesTtlMs,
      generate: () => generateSentenceParaphrases({ inputLanguage, learningLanguage, learningSentence }, abortController.signal),
      coalesce: false,
    })
    response.json({ paraphrases })
  } catch (error) {
    next(error)
  }
})

analysisRouter.post('/vocabulary', requireAuth, async (request, response, next) => {
  const startedAt = Date.now()
  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
  try {
    const inputLanguage = request.body.inputLanguage as LanguageCode
    const learningLanguage = request.body.learningLanguage as LanguageCode
    const rawSentences: unknown[] = Array.isArray(request.body.sentences) ? request.body.sentences : []
    const sentences: Array<{ inputText: string; learningSentence: string }> = rawSentences.map((sentence: unknown) => {
      if (typeof sentence !== 'object' || sentence === null) return { inputText: '', learningSentence: '' }
      const value = sentence as Record<string, unknown>
      return {
        inputText: typeof value.inputText === 'string' ? value.inputText.trim() : '',
        learningSentence: typeof value.learningSentence === 'string' ? value.learningSentence.trim() : '',
      }
    })
    const totalCharacters = sentences.reduce((total, sentence) => total + sentence.inputText.length + sentence.learningSentence.length, 0)
    if (!sentences.length || sentences.length > 20 || totalCharacters > 2_000 || sentences.some(sentence => !sentence.inputText || !sentence.learningSentence)) {
      response.status(400).json({ status: 'error', message: '어휘를 분석할 문장이 올바르지 않습니다.' })
      return
    }
    if (!Object.hasOwn(languageNames, inputLanguage) || !Object.hasOwn(languageNames, learningLanguage)) {
      response.status(400).json({ status: 'error', message: '언어 설정이 올바르지 않습니다.' })
      return
    }
    const summary = request.query.view === 'summary'
    const targetData = request.body.target
    let target: VocabularySummary | undefined
    if (targetData !== undefined) {
      if (summary || sentences.length !== 1 || typeof targetData?.word !== 'string'
        || !targetData.word.trim() || targetData.word.length > 500
        || !['B1', 'B2', 'C1', 'C2'].includes(targetData.level)
        || typeof targetData.basicMeaning !== 'string' || targetData.basicMeaning.length > 500
        || !isKoreanExplanation(targetData.basicMeaning)) {
        response.status(400).json({ message: '상세 정보를 요청한 어휘가 올바르지 않습니다.' })
        return
      }
      target = { word: targetData.word, level: targetData.level, basicMeaning: targetData.basicMeaning }
    }
    const userId = request.auth!.userId
    const keyParts = { inputLanguage, learningLanguage, sentences, target }
    const operation = summary ? 'sentence_vocabulary_summary_v1' : target ? 'sentence_vocabulary_detail_v2' : 'sentence_vocabulary_v17'
    const loadVocabulary = (signal: AbortSignal) => withAIResponseCache<VocabularySummary[][]>({
      userId,
      operation,
      keyParts,
      ttlMs: AI_RULES.cache.sentenceVocabularyTtlMs,
      generate: () => {
        const input = { text: sentences.map(sentence => sentence.inputText).join(' '), ...keyParts }
        return summary ? generateVocabularySummaries(input, signal) : generateSentenceVocabulary(input, signal)
      },
      shouldCache: vocabularies => summary || vocabularies.every(items => items.every(item => 'memoryTip' in item && Boolean(item.memoryTip))),
      coalesce: false,
    })
    if (request.query.async === '1') {
      const key = createAICacheKey({ operation, keyParts })
      const jobs = vocabularyJobs.get(userId) ?? new Map<string, VocabularyJob>()
      const existing = jobs.get(key)
      response.set('Cache-Control', 'no-store')
      if (existing?.status === 'running') {
        response.status(202).json({ jobId: existing.id })
        return
      }
      if (existing?.status === 'completed') {
        response.json({ vocabularies: existing.vocabularies })
        return
      }
      const job = { id: randomUUID() }
      vocabularyJobs.set(userId, jobs)
      jobs.set(key, { ...job, status: 'running' })
      response.status(202).json({ jobId: job.id })
      void loadVocabulary(AbortSignal.timeout(120_000)).then(
        vocabularies => jobs.set(key, { ...job, status: 'completed', vocabularies }),
        error => jobs.set(key, { ...job, status: 'failed', error }),
      ).finally(() => {
        setTimeout(() => {
          if (jobs.get(key)?.id === job.id) jobs.delete(key)
          if (!jobs.size && vocabularyJobs.get(userId) === jobs) vocabularyJobs.delete(userId)
        }, 5 * 60_000).unref()
      })
      return
    }
    const vocabularies = await loadVocabulary(abortController.signal)
    response.json({ vocabularies })
    console.info(JSON.stringify({
      event: 'sentence_vocabulary_response_sent',
      durationMs: Date.now() - startedAt,
      sentenceCount: sentences.length,
      vocabularyCount: vocabularies.reduce((total, items) => total + items.length, 0),
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'sentence_vocabulary_route_failed',
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }))
    next(error)
  }
})

analysisRouter.get('/jobs/latest', requireAuth, async (request, response, next) => {
  try {
    const job = await findAnalysisJob(request.auth!.userId)
    response.set('Cache-Control', 'no-store').json({ job: job ? presentAnalysisJob(job) : null })
  } catch (error) { next(error) }
})

analysisRouter.get('/jobs/:id', requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
      response.status(400).json({ message: '분석 작업 번호가 올바르지 않습니다.' })
      return
    }
    const job = await findAnalysisJob(request.auth!.userId, id)
    if (!job) {
      response.status(404).json({ message: '분석 작업이 없거나 보관 기간이 지났습니다.' })
      return
    }
    response.set('Cache-Control', 'no-store').json({ job: presentAnalysisJob(job) })
  } catch (error) { next(error) }
})

analysisRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const text = typeof request.body.text === 'string' ? request.body.text.replace(/\s+/gu, ' ').trim() : ''
    const inputLanguage = request.body.inputLanguage as LanguageCode
    const learningLanguage = request.body.learningLanguage as LanguageCode
    if (!text || text.length > 500) {
      response.status(400).json({ message: text ? '문장은 500자 이하로 입력해주세요.' : '분석할 문장을 입력해주세요.' })
      return
    }
    if (!Object.hasOwn(languageNames, inputLanguage) || !Object.hasOwn(languageNames, learningLanguage)) {
      response.status(400).json({ message: '지원하지 않는 언어입니다.' })
      return
    }
    const previous = await findAnalysisJob(request.auth!.userId)
    if (previous?.status === 'completed' && previous.result
      && previous.request_data.text === text && previous.request_data.inputLanguage === inputLanguage
      && previous.request_data.learningLanguage === learningLanguage) {
      // Both legacy synchronous clients and current polling clients can read this.
      response.set('Cache-Control', 'no-store').json({ job: presentAnalysisJob(previous), analysis: previous.result })
      return
    }
    const job = await createAnalysisJob(request.auth!.userId, { text, inputLanguage, learningLanguage })
    if (job.request_data.text !== text || job.request_data.inputLanguage !== inputLanguage || job.request_data.learningLanguage !== learningLanguage) {
      response.status(409).json({ message: '진행 중인 분석이 있습니다. 완료 후 다시 시도해 주세요.' })
      return
    }
    response.set('Cache-Control', 'no-store').status(202).json({
      job: presentAnalysisJob(job),
      // Older installed apps read message when the synchronous analysis field is absent.
      message: '분석이 접수되었습니다. 이전 버전의 화면을 사용 중이면 새로고침한 뒤 같은 문장으로 AI 분석 시작을 눌러주세요.',
    })
  } catch (error) { next(error) }
})
