import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpIcon,
  ArrowsClockwiseIcon,
  StarIcon,
  BookOpenIcon,
  BookBookmarkIcon,
  BrainIcon,
  SparkleIcon,
  PlantIcon,
  EyeIcon,
  EyeSlashIcon,
  FileTextIcon,
  LightbulbIcon,
  SpeakerHighIcon,
  TranslateIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import SpeechControls from '../components/study/SpeechControls'
import AiLoadingOverlay from '../components/ui/AiLoadingOverlay'
import { AlertDialog } from '../components/ui/Dialog'
import { analyzeSentence, getSentenceParaphrases, getSentenceVocabulary, type AnalysisRequest, type LanguageCode, type SentenceAnalysis } from '../services/analysis'
import { deleteVocabulary, getVocabularies, saveVocabulary, type SaveVocabularyInput } from '../services/vocabulary'

const speechLanguages: Record<LanguageCode, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR' }
const grammarRoleColors = { subject: '#2563D9', verb: '#008C44', other: '#18332A' } as const

function highlightExampleWord(text: string, word: string, memoryTip = false) {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return text
  // Keep Latin words whole while allowing vocabulary in unspaced languages.
  const term = /[\p{Script=Latin}]/u.test(word)
    ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`
    : escaped
  const quoted = memoryTip ? '|[“「『‘][^”」』’\\n]+[”」』’]|"[^"\\n]+"|\'[^\'\\n]+\'' : ''
  const pattern = new RegExp(`(${term}${quoted})`, 'giu')
  return text.split(pattern).map((part, index) => index % 2 === 1
    ? <mark className={memoryTip ? 'analysis-tip-highlight' : 'analysis-example-highlight'} key={index}>{part}</mark>
    : part)
}

export default function AnalysisPage({ request, requestId, onLoadingChange }: { request: AnalysisRequest; requestId: number; onLoadingChange: (isLoading: boolean) => void }) {
  const [showScrollTop, setShowScrollTop] = useState(false)
  useEffect(() => {
    const updateScrollTop = () => setShowScrollTop(window.scrollY > 400)
    updateScrollTop()
    window.addEventListener('scroll', updateScrollTop, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollTop)
  }, [])

  const [analysis, setAnalysis] = useState<SentenceAnalysis>()
  const [isLoading, setIsLoading] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const [isVocabularyLoading, setIsVocabularyLoading] = useState(false)
  const [vocabularyError, setVocabularyError] = useState('')
  const [wordActionAlert, setWordActionAlert] = useState<{ title: string; message: string }>()
  const [error, setError] = useState('')
  const [revealedChunks, setRevealedChunks] = useState<Set<string>>(new Set())
  const [openTranslations, setOpenTranslations] = useState<Set<number>>(new Set())
  const [openParaphrases, setOpenParaphrases] = useState<Set<number>>(new Set())
  const [loadingParaphrases, setLoadingParaphrases] = useState<Set<number>>(new Set())
  const [openExampleTranslations, setOpenExampleTranslations] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const saveWord = useMutation({
    mutationFn: ({ input }: { input: SaveVocabularyInput; wordKey: string }) => saveVocabulary(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
    onError: caught => setWordActionAlert({ title: '단어를 저장하지 못했어요', message: caught instanceof Error ? caught.message : '잠시 후 다시 시도해 주세요.' }),
  })
  const removeWord = useMutation({
    mutationFn: ({ vocabularyId }: { vocabularyId: string; wordKey: string }) => deleteVocabulary(vocabularyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
    onError: caught => setWordActionAlert({ title: '저장을 취소하지 못했어요', message: caught instanceof Error ? caught.message : '잠시 후 다시 시도해 주세요.' }),
  })
  const paraphraseControllersRef = useRef<Map<number, AbortController>>(new Map())

  const speak = (content: string, language: LanguageCode, rate = speechRate) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = speechLanguages[language]
    utterance.rate = rate
    window.speechSynthesis.speak(utterance)
  }

  const toggleInSet = <T,>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) => setter(current => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })

  const revealAllChunks = (sentenceIndex: number, count: number) => setRevealedChunks(current => {
    const next = new Set(current)
    const allVisible = Array.from({ length: count }, (_, index) => next.has(`${sentenceIndex}-${index}`)).every(Boolean)
    for (let index = 0; index < count; index += 1) {
      const key = `${sentenceIndex}-${index}`
      if (allVisible) next.delete(key)
      else next.add(key)
    }
    return next
  })

  const toggleParaphrases = async (sentenceIndex: number) => {
    if (openParaphrases.has(sentenceIndex)) {
      toggleInSet(setOpenParaphrases, sentenceIndex)
      return
    }
    const sentence = analysis?.sentences[sentenceIndex]
    if (!sentence) return
    if (!sentence.paraphrases.length) {
      paraphraseControllersRef.current.get(sentenceIndex)?.abort()
      const controller = new AbortController()
      paraphraseControllersRef.current.set(sentenceIndex, controller)
      setLoadingParaphrases(current => new Set(current).add(sentenceIndex))
      try {
        const paraphrases = await getSentenceParaphrases({
          inputLanguage: analysis.inputLanguage,
          learningLanguage: analysis.learningLanguage,
          learningSentence: sentence.learningSentence,
        }, controller.signal)
        setAnalysis(current => current && current.sentences[sentenceIndex]?.learningSentence === sentence.learningSentence ? {
          ...current,
          sentences: current.sentences.map((item, index) => index === sentenceIndex ? { ...item, paraphrases } : item),
        } : current)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof Error ? caught.message : '패러프레이징을 불러오지 못했습니다.')
        return
      } finally {
        if (paraphraseControllersRef.current.get(sentenceIndex) === controller) paraphraseControllersRef.current.delete(sentenceIndex)
        setLoadingParaphrases(current => { const next = new Set(current); next.delete(sentenceIndex); return next })
      }
    }
    setOpenParaphrases(current => new Set(current).add(sentenceIndex))
  }

  useEffect(() => {
    paraphraseControllersRef.current.forEach(controller => controller.abort())
    paraphraseControllersRef.current.clear()
    const controller = new AbortController()
    const run = async () => {
      setIsLoading(true)
      setIsVocabularyLoading(false)
      onLoadingChange(true)
      setError('')
      setVocabularyError('')
      setWordActionAlert(undefined)
      try {
        const nextAnalysis = await analyzeSentence(request, controller.signal)
        setAnalysis(nextAnalysis)
        setRevealedChunks(new Set())
        setOpenTranslations(new Set())
        setOpenParaphrases(new Set())
        setLoadingParaphrases(new Set())
        setOpenExampleTranslations(new Set())
        setIsLoading(false)
        onLoadingChange(false)
        setIsVocabularyLoading(true)
        try {
          const vocabularies = await getSentenceVocabulary({
            inputLanguage: nextAnalysis.inputLanguage,
            learningLanguage: nextAnalysis.learningLanguage,
            sentences: nextAnalysis.sentences.map(sentence => ({
              inputText: sentence.inputText,
              learningSentence: sentence.learningSentence,
            })),
          }, controller.signal)
          setAnalysis(current => current ? {
            ...current,
            sentences: current.sentences.map((sentence, index) => ({
              ...sentence,
              vocabulary: vocabularies[index] ?? [],
            })),
          } : current)
        } catch (caught) {
          if (!controller.signal.aborted) {
            setVocabularyError(caught instanceof Error ? caught.message : '상세 어휘를 불러오지 못했습니다.')
          }
        } finally {
          if (!controller.signal.aborted) setIsVocabularyLoading(false)
        }
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof Error ? caught.message : 'AI 분석을 완료하지 못했습니다.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          onLoadingChange(false)
        }
      }
    }
    // React StrictMode mounts effects twice in development. Defer the request by
    // one tick so the verification mount is cleaned up before any network call.
    const requestTimer = window.setTimeout(() => void run(), 0)
    return () => {
      window.clearTimeout(requestTimer)
      controller.abort()
      onLoadingChange(false)
    }
  }, [onLoadingChange, request, requestId])

  return <div className="analysis-page analysis-page-v2 analysis-results-root">
    {error && <p role="alert" className="analysis-result-error">{error}</p>}
    <AiLoadingOverlay open={isLoading} kind="analysis"/>

    {analysis && <div className={`analysis-content-v2${isLoading ? ' refreshing' : ''}`}>
      {analysis.warnings.map((warning, index) => <div className="analysis-warning" role="status" key={`${warning}-${index}`}><WarningCircleIcon weight="fill"/><span>{warning}</span></div>)}

      <section className="analysis-background-v2"><div className="analysis-background-heading"><BookBookmarkIcon weight="duotone" aria-hidden="true"/><h3>배경 지식</h3></div><p>{analysis.backgroundKnowledge}</p></section>

      {analysis.sentences.map((sentence, sentenceIndex) => {
        const showVocabulary = sentence.vocabulary.length > 0 || isVocabularyLoading || Boolean(vocabularyError)
        const translationOpen = openTranslations.has(sentenceIndex)
        const paraphrasesOpen = openParaphrases.has(sentenceIndex)
        const paraphrasesLoading = loadingParaphrases.has(sentenceIndex)
        const allChunksVisible = sentence.chunks.every((_, chunkIndex) => revealedChunks.has(`${sentenceIndex}-${chunkIndex}`))
        return <article className="sentence-analysis-card" key={`${sentence.inputText}-${sentenceIndex}`}>
          <header className="sentence-analysis-header">
            <div className="sentence-analysis-title-row"><h2><FileTextIcon className="analysis-heading-icon analysis-icon-sentence" weight="duotone" aria-hidden="true"/>문장 분석</h2><SpeechControls rate={speechRate} onRateChange={setSpeechRate} onPlay={() => speak(sentence.learningSentence, analysis.learningLanguage)}/></div>
            <p className="sentence-analysis-text">{sentence.chunks.map((chunk, chunkIndex) => {
              const nextChunk = sentence.chunks[chunkIndex + 1]
              const joinsNext = /[-'’]$/u.test(chunk.targetText) || (nextChunk ? /^[,.;:!?)}\]»]/u.test(nextChunk.targetText) : false)
              return <span className={`sentence-role-${chunk.role}`} style={{ color: grammarRoleColors[chunk.role] }} key={`${chunk.targetText}-${chunkIndex}`}>{chunk.targetText}{nextChunk && !joinsNext ? ' ' : ''}</span>
            })}</p>
          </header>

          <div className={`sentence-analysis-grid${showVocabulary ? '' : ' without-vocabulary'}`}>
            <div className="sentence-study-column">
              <section className="sentence-study-section chunk-practice">
                <div className="sentence-section-heading"><h3><BrainIcon className="analysis-heading-icon analysis-icon-chunks" weight="duotone" aria-hidden="true"/>직독직해 연습</h3><button onClick={() => revealAllChunks(sentenceIndex, sentence.chunks.length)}>{allChunksVisible ? '모두 숨기기' : '모두 보기'}</button></div>
                <div className="clickable-chunks">{sentence.chunks.map((chunk, chunkIndex) => {
                  const chunkKey = `${sentenceIndex}-${chunkIndex}`
                  const revealed = revealedChunks.has(chunkKey)
                  return <div key={chunkKey}><b className={`role-${chunk.role}`} style={{ color: grammarRoleColors[chunk.role] }}>{chunk.targetText}</b><button className={revealed ? 'revealed' : ''} aria-label={`${chunk.targetText} 해석 ${revealed ? '숨기기' : '보기'}`} aria-expanded={revealed} onClick={() => toggleInSet(setRevealedChunks, chunkKey)}>{revealed ? chunk.sourceMeaning : ''}</button></div>
                })}</div>
              </section>

              <section className="sentence-study-section">
                <div className="sentence-section-heading"><h3><TranslateIcon className="analysis-heading-icon analysis-icon-translation" weight="duotone" aria-hidden="true"/>완전한 해석</h3><button onClick={() => toggleInSet(setOpenTranslations, sentenceIndex)}>{translationOpen ? <EyeSlashIcon /> : <EyeIcon />}{translationOpen ? '숨기기' : '보기'}</button></div>
                {translationOpen ? <div className="bilingual-translation"><p><b>KO</b><span>{sentence.koreanTranslation}</span></p><p><b>EN</b><span>{sentence.englishTranslation}</span></p></div> : <button className="section-placeholder" onClick={() => toggleInSet(setOpenTranslations, sentenceIndex)}>클릭하여 해석 보기</button>}
              </section>

              <section className="sentence-study-section">
                <div className="sentence-section-heading"><h3><ArrowsClockwiseIcon className="analysis-heading-icon analysis-icon-paraphrases" weight="duotone" aria-hidden="true"/>수준별 패러프레이징</h3><button disabled={paraphrasesLoading} onClick={() => void toggleParaphrases(sentenceIndex)}>{paraphrasesOpen ? <EyeSlashIcon /> : <EyeIcon />}{paraphrasesLoading ? '생성 중…' : paraphrasesOpen ? '숨기기' : '보기'}</button></div>
                {paraphrasesOpen ? <div className="level-paraphrases">{sentence.paraphrases.map(item => <article className={`level-${item.level.toLowerCase()}`} key={item.level}><b><span className="level-code">{item.level}</span><span className="level-name">{item.level === 'B1' ? '중급' : item.level === 'B2' ? '중고급' : item.level === 'C1' ? '고급' : '최상급'}</span></b><p>{item.targetText}</p></article>)}</div> : <button className="section-placeholder" disabled={paraphrasesLoading} onClick={() => void toggleParaphrases(sentenceIndex)}>{paraphrasesLoading ? '수준별 표현을 생성하고 있어요…' : '클릭하여 패러프레이징 보기'}</button>}
              </section>
            </div>

            {showVocabulary && <aside className="sentence-vocab-column">
              <h3><BookOpenIcon className="analysis-heading-icon analysis-icon-vocabulary" weight="duotone" aria-hidden="true"/>핵심 어휘</h3>
              {isVocabularyLoading && sentence.vocabulary.length === 0 ? <div className="empty-vocabulary">상세 어휘를 정리하고 있어요…</div>
                : vocabularyError && sentence.vocabulary.length === 0 ? <div className="empty-vocabulary">{vocabularyError}</div>
                : sentence.vocabulary.map(word => {
                const wordKey = `${sentenceIndex}-${word.word}`
                const exampleTranslationOpen = openExampleTranslations.has(wordKey)
                const savedVocabulary = vocabulariesQuery.data?.find(item => item.languageCode === analysis.learningLanguage && item.word.toLocaleLowerCase() === word.word.toLocaleLowerCase())
                const saved = Boolean(savedVocabulary)
                const saving = (saveWord.isPending && saveWord.variables.wordKey === wordKey)
                  || (removeWord.isPending && removeWord.variables.wordKey === wordKey)
                return <article className="sentence-vocab-card" key={wordKey}>
                  <button className={saved ? 'saved' : ''} disabled={saving} aria-label={saved ? '단어 저장 취소' : '단어장에 저장'} aria-pressed={saved} onClick={() => {
                    setWordActionAlert(undefined)
                    if (savedVocabulary) removeWord.mutate({ vocabularyId: savedVocabulary.vocabularyId, wordKey })
                    else saveWord.mutate({ wordKey, input: { languageCode: analysis.learningLanguage, word: word.word, meaning: word.basicMeaning, contextMeaning: word.contextualMeaning, cefrLevel: word.level, etymology: word.etymology, memoryTip: word.memoryTip, exampleSentence: word.exampleSentence, exampleTranslation: word.exampleMeaning } })
                  }}><StarIcon weight={saved ? 'fill' : 'regular'}/></button>
                  <div className="sentence-vocab-title"><div className="sentence-vocab-name"><h4><span className="sentence-vocab-word">{word.word}</span><span className="sentence-vocab-level" aria-label={`CEFR ${word.level}`}>{word.level}</span></h4>{word.pronunciation && <small className="vocab-pronunciation" aria-label={`발음 ${word.pronunciation}`}>{word.pronunciation}</small>}</div><button aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, analysis.learningLanguage)}><SpeakerHighIcon/></button></div>
                  <p className="sentence-vocab-basic"><b>기본:</b> {word.basicMeaning}</p><p className="sentence-vocab-context"><b>문맥:</b> {word.contextualMeaning}</p>
                  <div className="analysis-word-details">
                    {word.exampleSentence && <div className="analysis-word-example"><div className="analysis-word-detail-heading"><b><SparkleIcon weight="fill" aria-hidden="true"/>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence, analysis.learningLanguage)}><SpeakerHighIcon/></button>{word.exampleMeaning && <button type="button" className={exampleTranslationOpen ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-pressed={exampleTranslationOpen} onClick={() => toggleInSet(setOpenExampleTranslations, wordKey)}><TranslateIcon/></button>}</div></div><blockquote>{word.exampleMeaning ? <button type="button" className="analysis-example-toggle" aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-expanded={exampleTranslationOpen} onClick={() => toggleInSet(setOpenExampleTranslations, wordKey)}>{highlightExampleWord(word.exampleSentence, word.word)}</button> : highlightExampleWord(word.exampleSentence, word.word)}</blockquote>{exampleTranslationOpen && word.exampleMeaning && <p className="analysis-word-example-translation">{word.exampleMeaning}</p>}</div>}
                    {word.etymology && <div className="analysis-word-etymology"><b><PlantIcon weight="fill" aria-hidden="true"/>어원</b><p>{word.etymology}</p></div>}
                    {word.memoryTip && <div className="analysis-word-memory-tip"><b><LightbulbIcon weight="fill" aria-hidden="true"/>AI 스마트 암기 팁</b><p>{highlightExampleWord(word.memoryTip, word.word, true)}</p></div>}
                  </div>
                </article>
              })}
            </aside>}
          </div>
        </article>
      })}
    </div>}
    {showScrollTop && <button type="button" className="analysis-scroll-top" aria-label="맨 위로 이동" title="맨 위로 이동" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ArrowUpIcon weight="bold" aria-hidden="true"/></button>}
    <AlertDialog open={Boolean(wordActionAlert)} title={wordActionAlert?.title ?? ''} message={wordActionAlert?.message ?? ''} tone="warning" onClose={() => setWordActionAlert(undefined)}/>
  </div>
}
