import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowsClockwiseIcon,
  BookmarkSimpleIcon,
  BookOpenIcon,
  BrainIcon,
  EyeIcon,
  EyeSlashIcon,
  FileTextIcon,
  LightbulbIcon,
  MicrophoneIcon,
  SpeakerHighIcon,
  TranslateIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import Icon from '../components/Icon'
import { analyzeSentence, getSentenceParaphrases, getSentenceVocabulary, type AnalysisRequest, type LanguageCode, type SentenceAnalysis } from '../services/analysis'
import { deleteVocabulary, getVocabularies, saveVocabulary, type SaveVocabularyInput } from '../services/vocabulary'

const speechLanguages: Record<LanguageCode, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR' }
const grammarRoleColors = { subject: '#2563D9', verb: '#008C44', other: '#18332A' } as const

export default function AnalysisPage({ request, requestId, onLoadingChange }: { request: AnalysisRequest; requestId: number; onLoadingChange: (isLoading: boolean) => void }) {
  const [analysis, setAnalysis] = useState<SentenceAnalysis>()
  const [isLoading, setIsLoading] = useState(false)
  const [isVocabularyLoading, setIsVocabularyLoading] = useState(false)
  const [vocabularyError, setVocabularyError] = useState('')
  const [error, setError] = useState('')
  const [revealedChunks, setRevealedChunks] = useState<Set<string>>(new Set())
  const [openTranslations, setOpenTranslations] = useState<Set<number>>(new Set())
  const [openParaphrases, setOpenParaphrases] = useState<Set<number>>(new Set())
  const [loadingParaphrases, setLoadingParaphrases] = useState<Set<number>>(new Set())
  const [openExampleTranslations, setOpenExampleTranslations] = useState<Set<string>>(new Set())
  const [recordingSentence, setRecordingSentence] = useState<number>()
  const queryClient = useQueryClient()
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const saveWord = useMutation({
    mutationFn: (input: SaveVocabularyInput) => saveVocabulary(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
    onError: caught => setError(caught instanceof Error ? caught.message : '단어를 저장하지 못했습니다.'),
  })
  const removeWord = useMutation({
    mutationFn: deleteVocabulary,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
    onError: caught => setError(caught instanceof Error ? caught.message : '저장된 단어를 삭제하지 못했습니다.'),
  })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const paraphraseControllersRef = useRef<Map<number, AbortController>>(new Map())

  const speak = (content: string, language: LanguageCode, rate = 1) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = speechLanguages[language]
    utterance.rate = rate
    window.speechSynthesis.speak(utterance)
  }

  const toggleRecording = async (sentenceIndex: number) => {
    if (recordingSentence === sentenceIndex) {
      mediaRecorderRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setError('이 브라우저에서는 음성 녹음을 지원하지 않습니다.')
      return
    }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data.size) recordedChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        setRecordingSentence(undefined)
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType })
        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)
        audio.onended = () => URL.revokeObjectURL(audioUrl)
        void audio.play().catch(() => URL.revokeObjectURL(audioUrl))
      }
      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop())
        setRecordingSentence(undefined)
        setError('녹음 중 문제가 발생했습니다.')
      }
      mediaRecorderRef.current = recorder
      setError('')
      setRecordingSentence(sentenceIndex)
      recorder.start()
    } catch {
      setError('마이크 권한을 허용해야 녹음할 수 있습니다.')
    }
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
    {isLoading && !analysis && <section className="analysis-loading" aria-live="polite"><div className="analysis-loading-orb"><Icon>✦</Icon></div><strong>문장을 학습하기 좋게 분석하고 있어요</strong><span>자연스러운 표현과 핵심 어휘를 정리하는 중입니다.</span><div className="analysis-loading-bar"><i /></div></section>}
    {isLoading && analysis && <div className="analysis-refreshing" aria-live="polite"><Icon>✦</Icon><span>새 문장을 분석하고 있어요. 기존 결과는 잠시 유지됩니다.</span></div>}

    {analysis && <div className={`analysis-content-v2${isLoading ? ' refreshing' : ''}`}>
      {analysis.warnings.map((warning, index) => <div className="analysis-warning" role="status" key={`${warning}-${index}`}><WarningCircleIcon weight="fill"/><span>{warning}</span></div>)}

      <section className="analysis-background-v2"><LightbulbIcon weight="fill"/><div><h3>배경 지식</h3><p>{analysis.backgroundKnowledge}</p></div></section>

      {analysis.sentences.map((sentence, sentenceIndex) => {
        const translationOpen = openTranslations.has(sentenceIndex)
        const paraphrasesOpen = openParaphrases.has(sentenceIndex)
        const paraphrasesLoading = loadingParaphrases.has(sentenceIndex)
        const allChunksVisible = sentence.chunks.every((_, chunkIndex) => revealedChunks.has(`${sentenceIndex}-${chunkIndex}`))
        return <article className="sentence-analysis-card" key={`${sentence.inputText}-${sentenceIndex}`}>
          <header className="sentence-analysis-header">
            <h2>{sentence.chunks.map((chunk, chunkIndex) => <span className={`sentence-role-${chunk.role}`} style={{ color: grammarRoleColors[chunk.role] }} key={`${chunk.targetText}-${chunkIndex}`}>{chunk.targetText}{chunkIndex < sentence.chunks.length - 1 ? ' ' : ''}</span>)}</h2>
            <div className="sentence-voice-actions"><button className={`voice-record${recordingSentence === sentenceIndex ? ' recording' : ''}`} aria-label={recordingSentence === sentenceIndex ? '녹음 종료' : '발음 녹음하기'} aria-pressed={recordingSentence === sentenceIndex} onClick={() => void toggleRecording(sentenceIndex)}><MicrophoneIcon weight={recordingSentence === sentenceIndex ? 'fill' : 'bold'}/></button><button className="voice-play" aria-label="문장 발음 듣기" onClick={() => speak(sentence.learningSentence, analysis.learningLanguage)}><SpeakerHighIcon weight="fill"/></button></div>
          </header>

          <div className="sentence-analysis-grid">
            <div className="sentence-study-column">
              <section className="sentence-study-section chunk-practice">
                <div className="sentence-section-heading"><h3><BrainIcon />직독직해 연습</h3><button onClick={() => revealAllChunks(sentenceIndex, sentence.chunks.length)}>{allChunksVisible ? '모두 숨기기' : '모두 보기'}</button></div>
                <div className="clickable-chunks">{sentence.chunks.map((chunk, chunkIndex) => {
                  const chunkKey = `${sentenceIndex}-${chunkIndex}`
                  const revealed = revealedChunks.has(chunkKey)
                  return <div key={chunkKey}><b className={`role-${chunk.role}`} style={{ color: grammarRoleColors[chunk.role] }}>{chunk.targetText}</b><button className={revealed ? 'revealed' : ''} aria-label={`${chunk.targetText} 해석 ${revealed ? '숨기기' : '보기'}`} aria-expanded={revealed} onClick={() => toggleInSet(setRevealedChunks, chunkKey)}>{revealed ? chunk.sourceMeaning : ''}</button></div>
                })}</div>
              </section>

              <section className="sentence-study-section">
                <div className="sentence-section-heading"><h3><FileTextIcon />완전한 해석</h3><button onClick={() => toggleInSet(setOpenTranslations, sentenceIndex)}>{translationOpen ? <EyeSlashIcon /> : <EyeIcon />}{translationOpen ? '숨기기' : '보기'}</button></div>
                {translationOpen ? <div className="bilingual-translation"><p><b>KO</b><span>{sentence.koreanTranslation}</span></p><p><b>EN</b><span>{sentence.englishTranslation}</span></p></div> : <button className="section-placeholder" onClick={() => toggleInSet(setOpenTranslations, sentenceIndex)}>클릭하여 해석 보기</button>}
              </section>

              <section className="sentence-study-section">
                <div className="sentence-section-heading"><h3><ArrowsClockwiseIcon />수준별 패러프레이징</h3><button disabled={paraphrasesLoading} onClick={() => void toggleParaphrases(sentenceIndex)}>{paraphrasesOpen ? <EyeSlashIcon /> : <EyeIcon />}{paraphrasesLoading ? '생성 중…' : paraphrasesOpen ? '숨기기' : '보기'}</button></div>
                {paraphrasesOpen ? <div className="level-paraphrases">{sentence.paraphrases.map(item => <article className={`level-${item.level.toLowerCase()}`} key={item.level}><b><span className="level-code">{item.level}</span><span className="level-name">{item.level === 'B1' ? '중급' : item.level === 'B2' ? '중고급' : item.level === 'C1' ? '고급' : '최상급'}</span></b><p>{item.targetText}</p></article>)}</div> : <button className="section-placeholder" disabled={paraphrasesLoading} onClick={() => void toggleParaphrases(sentenceIndex)}>{paraphrasesLoading ? '수준별 표현을 생성하고 있어요…' : '클릭하여 패러프레이징 보기'}</button>}
              </section>
            </div>

            <aside className="sentence-vocab-column">
              <h3><BookOpenIcon />핵심 어휘</h3>
              {isVocabularyLoading && sentence.vocabulary.length === 0 ? <div className="empty-vocabulary">상세 어휘를 정리하고 있어요…</div>
                : vocabularyError && sentence.vocabulary.length === 0 ? <div className="empty-vocabulary">{vocabularyError}</div>
                : sentence.vocabulary.length === 0 ? <div className="empty-vocabulary">추출된 주요 어휘가 없습니다.</div> : sentence.vocabulary.map(word => {
                const wordKey = `${sentenceIndex}-${word.word}`
                const exampleTranslationOpen = openExampleTranslations.has(wordKey)
                const savedVocabulary = vocabulariesQuery.data?.find(item => item.languageCode === analysis.learningLanguage && item.word.toLocaleLowerCase() === word.word.toLocaleLowerCase())
                const saved = Boolean(savedVocabulary)
                const saving = (saveWord.isPending && saveWord.variables.word === word.word)
                  || (removeWord.isPending && removeWord.variables === savedVocabulary?.vocabularyId)
                return <article className="sentence-vocab-card" key={wordKey}>
                  <button className={saved ? 'saved' : ''} disabled={saving} aria-label={saved ? '단어 저장 취소' : '단어장에 저장'} aria-pressed={saved} onClick={() => {
                    setError('')
                    if (savedVocabulary) removeWord.mutate(savedVocabulary.vocabularyId)
                    else saveWord.mutate({ languageCode: analysis.learningLanguage, word: word.word, meaning: word.basicMeaning, contextMeaning: word.contextualMeaning, cefrLevel: word.level, etymology: word.etymology, memoryTip: word.memoryTip, exampleSentence: word.exampleSentence, exampleTranslation: word.exampleMeaning })
                  }}><BookmarkSimpleIcon weight={saved ? 'fill' : 'regular'}/></button>
                  <div className="sentence-vocab-title"><h4>{word.word}</h4><span>{word.level}</span><button aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, analysis.learningLanguage)}><SpeakerHighIcon/></button></div>
                  <p><b>기본:</b> {word.basicMeaning}</p><p><b>문맥:</b> {word.contextualMeaning}</p>
                  {word.exampleSentence && <div className="vocab-example"><div><b>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence, analysis.learningLanguage)}><SpeakerHighIcon/></button>{word.exampleMeaning && <button type="button" className={exampleTranslationOpen ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-pressed={exampleTranslationOpen} onClick={() => toggleInSet(setOpenExampleTranslations, wordKey)}><TranslateIcon/></button>}</div></div><p>{word.exampleSentence}</p>{exampleTranslationOpen && word.exampleMeaning && <p className="vocab-example-meaning">{word.exampleMeaning}</p>}</div>}
                  {word.etymology && <div className="vocab-etymology"><BookOpenIcon weight="duotone"/><span><b>어원:</b> {word.etymology}</span></div>}
                  {word.memoryTip && <div className="vocab-tip"><LightbulbIcon weight="fill"/><span><b>팁:</b> {word.memoryTip}</span></div>}
                </article>
              })}
            </aside>
          </div>
        </article>
      })}
    </div>}
  </div>
}
