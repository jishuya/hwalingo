import LearningTimer from '../components/learning/LearningTimer'
import { AlertDialog } from '../components/ui/Dialog'
import DialogCloseButton from '../components/ui/DialogCloseButton'
import { useEffect, useRef, useState } from 'react'
import { ArrowsLeftRightIcon, EqualsIcon, PaletteIcon, BookOpenIcon, FireIcon, ImageIcon, LightbulbIcon, MagicWandIcon, SpeakerHighIcon, StarIcon, TranslateIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QuizRequestError, createQuizSession, generateVocabularyImage, getQuizSession, getVocabularyDeepAnalysis, submitQuizAnswer } from '../services/quiz'
import QuizComplete from '../components/quiz/QuizComplete'
import './QuizPage.css'

type DetailPanel = 'etymology' | 'memory' | 'deep' | 'image' | null

const languageFlags: Record<string, string> = { ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵', zh: '🇨🇳', fr: '🇫🇷' }

const speechLocales: Record<string, string> = { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR' }

function highlightLearningText(text: string, word: string, meaning: string) {
  const keywords = [word, ...meaning.split(/[,;·/\n]/u)]
    .map(value => value.trim()).filter(Boolean)
    .sort((left, right) => right.length - left.length)
  const terms = keywords.map(value => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return /[\p{Script=Latin}]/u.test(value)
      ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`
      : escaped
  })
  const quoted = /“[^”\n]+”|「[^」\n]+」|『[^』\n]+』|‘[^’\n]+’|"[^"\n]+"|'[^'\n]+'/u.source
  const pattern = new RegExp(`(${[...terms, quoted].join('|')})`, 'giu')
  return text.split(pattern).map((part, index) => index % 2 === 1
    ? <mark className="quiz-learning-highlight" key={index}>{part}</mark>
    : part)
}

function submitTimedAnswer(sessionId: string, itemId: string, correct: boolean, startedAt: number) {
  return submitQuizAnswer(sessionId, itemId, correct, startedAt ? Date.now() - startedAt : 0)
}

export default function QuizPage({ onHome, mode = 'standard' }: { onHome: () => void; mode?: 'standard' | 'incorrect' }) {
  const queryClient = useQueryClient()
  const [showSwipeGuide, setShowSwipeGuide] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null)
  const [showExampleTranslation, setShowExampleTranslation] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)
  const questionStartedAt = useRef(0)
  const sessionQuery = useQuery({ queryKey: ['quiz', 'new-session', mode], queryFn: () => createQuizSession(undefined, mode), retry: false, staleTime: Infinity, refetchOnMount: 'always' })
  const session = sessionQuery.data
  const current = session?.items.find(item => !item.result)
  // 재도전도 원래 문제 ID로 묶어, 정답을 맞힌 문제만 한 번씩 완료 처리한다.
  const completedCount = new Set(session?.items
    .filter(item => item.result === 'correct')
    .map(item => item.retryOfItemId ?? item.id)).size
  const retryWordCount = session?.items.filter(item => !item.retryOfItemId && item.result === 'incorrect').length ?? 0

  const resetCard = () => {
    setRevealed(false)
    setDetailPanel(null)
    setShowExampleTranslation(false)
    setDragOffset(0)
    setDragging(false)
    dragStart.current = null
    questionStartedAt.current = 0
  }

  const next = async () => {
    if (!session) return
    const updated = await queryClient.fetchQuery({ queryKey: ['quiz', 'session', session.id], queryFn: () => getQuizSession(session.id) })
    queryClient.setQueryData(['quiz', 'new-session', mode], updated)
    resetCard()
  }

  const answerMutation = useMutation({
    mutationFn: (correct: boolean) => submitTimedAnswer(session!.id, current!.id, correct, questionStartedAt.current),
    onSuccess: async () => {
      await new Promise(resolve => window.setTimeout(resolve, 180))
      await next()
    },
    onError: () => setDragOffset(0),
  })
  const answerPending = answerMutation.isPending || !current
  const mutateAnswer = answerMutation.mutate
  const deepAnalysisMutation = useMutation({ mutationFn: ({ sessionId, itemId }: { sessionId: string; itemId: string }) => getVocabularyDeepAnalysis(sessionId, itemId) })
  const imageMutation = useMutation({ mutationFn: ({ sessionId, itemId }: { sessionId: string; itemId: string }) => generateVocabularyImage(sessionId, itemId) })

  const grade = (correct: boolean) => {
    if (answerPending) return
    setDragOffset(correct ? window.innerWidth : -window.innerWidth)
    answerMutation.mutate(correct)
  }

  useEffect(() => {
    const handleArrowGrade = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      if (answerPending || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      event.preventDefault()
      const correct = event.key === 'ArrowRight'
      setDragOffset(correct ? window.innerWidth : -window.innerWidth)
      mutateAnswer(correct)
    }
    window.addEventListener('keydown', handleArrowGrade)
    return () => window.removeEventListener('keydown', handleArrowGrade)
  }, [answerPending, mutateAnswer])

  const speak = () => {
    if (!current || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(current.word)
    utterance.lang = speechLocales[current.languageCode] ?? current.languageCode
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  const togglePanel = (panel: Exclude<DetailPanel, null>) => {
    const opening = detailPanel !== panel
    setDetailPanel(opening ? panel : null)
    if (!opening || !session || !current) return
    if (panel === 'deep' && (deepAnalysisMutation.variables?.itemId !== current.id || !deepAnalysisMutation.data)) deepAnalysisMutation.mutate({ sessionId: session.id, itemId: current.id })
    if (panel === 'image' && (imageMutation.variables?.itemId !== current.id || !imageMutation.isSuccess)) imageMutation.mutate({ sessionId: session.id, itemId: current.id })
  }
  const toggleMeaning = () => {
    setRevealed(previous => {
      if (!previous) questionStartedAt.current = Date.now()
      return !previous
    })
  }
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (answerPending) return
    const target = event.target
    if (target instanceof Element && target.closest('button, a, input, textarea, select, [role="button"]')) return
    dragStart.current = event.clientX
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (dragStart.current === null || answerPending) return
    setDragOffset(event.clientX - dragStart.current)
  }
  const onPointerUp = () => {
    if (dragStart.current === null) return
    dragStart.current = null
    setDragging(false)
    if (Math.abs(dragOffset) >= 80) grade(dragOffset > 0)
    else setDragOffset(0)
  }

  if (sessionQuery.isPending) return <div className="quiz-page page"><div className="empty-state"><p>오늘의 테스트를 준비하고 있어요.</p></div></div>
  if (sessionQuery.isError && sessionQuery.error.message === '테스트할 단어가 없습니다. 먼저 단어장에 단어를 저장해주세요.') return <div className="quiz-page page"><div className="empty-state vocabulary-empty"><StarIcon/><h2>테스트할 단어가 없어요</h2><p>AI 문장 분석의 핵심 어휘를 단어장에 저장하면<br/>이곳에서 테스트로 복습할 수 있어요.</p></div></div>
  if (sessionQuery.isError && sessionQuery.error.message.startsWith('오늘 추가로 풀 단어')) return <div className="quiz-page page"><div className="empty-state"><h2>추가 학습을 모두 마쳤어요</h2><p>{sessionQuery.error.message}</p></div></div>
  if (sessionQuery.isError && sessionQuery.error.message === '테스트할 오답 단어가 없어요.') return <div className="quiz-page page"><div className="empty-state"><h2>테스트할 오답 단어가 없어요</h2><button className="primary" onClick={onHome}>단어장으로</button></div></div>
  if (sessionQuery.isError && sessionQuery.error instanceof QuizRequestError && sessionQuery.error.code === 'INSUFFICIENT_VOCABULARY') return <div className="quiz-page page"><AlertDialog open tone="warning" title="테스트할 단어가 부족해요" message={<>{sessionQuery.error.message.split(/(\d+개)/u).map((part, index) => index % 2 === 1 ? <strong key={index}>{part}</strong> : part)}</>} onClose={onHome}/></div>
  if (sessionQuery.isError) return <div className="quiz-page page"><div className="empty-state"><h2>테스트를 시작할 수 없어요</h2><p>{sessionQuery.error.message}</p><button className="primary" onClick={() => void sessionQuery.refetch()}>다시 시도</button></div></div>
  if (!session) return null
  if (!current) return <QuizComplete key={session.id} mode={mode}
    accuracy={session.totalCount ? Math.round(session.correctCount / session.totalCount * 100) : 0}
    earnedXp={session.earnedXp} relearnedCount={retryWordCount} onHome={onHome}
    onRestart={() => { queryClient.removeQueries({ queryKey: ['quiz'] }); void sessionQuery.refetch() }}/>


  const progressCount = Math.min(session.totalCount, completedCount)
  const progress = session.totalCount ? (progressCount / session.totalCount) * 100 : 100
  const answeredItems = session.items.filter(item => !item.retryOfItemId && item.result)
  let correctStreak = 0
  for (let index = answeredItems.length - 1; index >= 0 && answeredItems[index].result === 'correct'; index--) correctStreak++
  const example = current.exampleSentence || '저장된 예문이 아직 없어요.'
  const wordIndex = example.toLocaleLowerCase().indexOf(current.word.toLocaleLowerCase())
  const reviewMinutes = current.reviewIntervalMinutes
  const reviewLabel = reviewMinutes && reviewMinutes > 0
    ? `${reviewMinutes >= 1440 ? `${Math.round(reviewMinutes / 1440)}일` : reviewMinutes >= 60 ? `${Math.round(reviewMinutes / 60)}시간` : `${reviewMinutes}분`} 뒤 복습`
    : null
  const tilt = Math.max(-7, Math.min(7, dragOffset / 28))

  return <div className="quiz-page quiz-flash-page page">
    <LearningTimer activity="quiz" enabled/>
    {showSwipeGuide && <div className="quiz-swipe-guide-overlay" role="presentation" onPointerDown={() => setShowSwipeGuide(false)}>
      <div className="quiz-swipe-guide" role="dialog" aria-label="테스트 사용 안내" onPointerDown={event => event.stopPropagation()}>
        <DialogCloseButton label="안내 닫기" onClose={() => setShowSwipeGuide(false)}/>
        <p>아는 단어는 <strong className="direction-right">오른쪽</strong>으로<br/>모르는 단어는 <strong className="direction-left">왼쪽</strong>으로 스와이프하세요.</p>
      </div>
    </div>}
    <div className="quiz-progress"><div><div className="quiz-progress-labels"><span className="quiz-progress-title"><span aria-hidden="true">🌱</span>{mode === 'incorrect' ? '오답 단어 테스트' : '오늘의 단어 챌린지'}</span>{correctStreak > 0 && <span className="quiz-progress-streak"><FireIcon weight="fill"/> 연속 {correctStreak}개 정답!</span>}</div><b className="quiz-progress-count">{progressCount}<small> / {session.totalCount}</small></b></div><div className="progress-track" role="progressbar" aria-label="테스트 진행률" aria-valuemin={0} aria-valuemax={session.totalCount} aria-valuenow={progressCount}><span style={{ width: `${progress}%` }}/></div></div>
    <div className="quiz-swipe-stage">
      <section className={`quiz-flash-card card ${revealed ? 'revealed' : ''} ${dragging ? 'dragging' : ''} ${dragOffset < -15 ? 'swipe-wrong' : dragOffset > 15 ? 'swipe-correct' : ''}`} style={{ transform: `translateX(${dragOffset}px) rotate(${tilt}deg)` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="quiz-card-badges">
          <span className="quiz-language-badge" aria-label={`현재 문제 언어 ${current.languageCode.toUpperCase()}`}>{languageFlags[current.languageCode] && <span className="quiz-language-flag" aria-hidden="true">{languageFlags[current.languageCode]}</span>}{current.languageCode.toUpperCase()}</span>
          {reviewLabel && <span className="quiz-review-badge">{reviewLabel}</span>}
          {current.cefrLevel && <span className={`quiz-level level-${current.cefrLevel.toLowerCase()}`} aria-label={`단어 등급 ${current.cefrLevel}`}>{current.cefrLevel}</span>}
        </div>
        <button className="quiz-word-reveal" type="button" onClick={toggleMeaning} aria-label={revealed ? `${current.word} 뜻 숨기기` : `${current.word} 뜻 보기`} aria-pressed={revealed}>
          <strong>{current.word}</strong>
          {!revealed && <small>단어를 눌러 뜻을 확인하세요</small>}
          {revealed && <span className="quiz-meaning">{current.meaning}</span>}
        </button>
        <button className="quiz-sound" type="button" onClick={event => { event.stopPropagation(); speak() }} aria-label={`${current.word} 발음 듣기`}><SpeakerHighIcon weight="fill"/></button>
        <div className="quiz-example"><div><b className="quiz-example-label"><span aria-hidden="true"/>예문</b>{current.exampleTranslation && <button type="button" className={showExampleTranslation ? 'active' : ''} aria-label={`예문 해석 ${showExampleTranslation ? '숨기기' : '보기'}`} aria-pressed={showExampleTranslation} onClick={() => setShowExampleTranslation(value => !value)}><TranslateIcon/></button>}</div><p><button className="quiz-example-sentence" type="button" disabled={!current.exampleTranslation} aria-expanded={showExampleTranslation} aria-label={`예문 해석 ${showExampleTranslation ? '숨기기' : '보기'}`} onClick={() => setShowExampleTranslation(value => !value)}>{wordIndex >= 0 ? <>{example.slice(0, wordIndex)}<mark>{example.slice(wordIndex, wordIndex + current.word.length)}</mark>{example.slice(wordIndex + current.word.length)}</> : example}</button></p>{showExampleTranslation && current.exampleTranslation && <p className="quiz-example-translation">{current.exampleTranslation}</p>}</div>
        <div className="quiz-tools-heading"><b><span className="quiz-tools-lightning" aria-hidden="true">💪</span> AI 보조 학습 파워업</b></div>
        <div className="quiz-detail-tabs">
          <button className={detailPanel === 'etymology' ? 'active' : ''} aria-expanded={detailPanel === 'etymology'} onClick={() => togglePanel('etymology')} type="button"><span className="quiz-tool-icon"><BookOpenIcon weight="duotone"/></span>어원 힌트</button>
          <button className={detailPanel === 'memory' ? 'active' : ''} aria-expanded={detailPanel === 'memory'} onClick={() => togglePanel('memory')} type="button"><span className="quiz-tool-icon"><LightbulbIcon weight="duotone"/></span>암기 팁</button>
          <button className={detailPanel === 'deep' ? 'active deep' : 'deep'} aria-expanded={detailPanel === 'deep'} onClick={() => togglePanel('deep')} type="button"><span className="quiz-tool-icon"><MagicWandIcon weight="duotone"/></span>AI 심화</button>
          <button className={detailPanel === 'image' ? 'active image' : 'image'} aria-expanded={detailPanel === 'image'} onClick={() => togglePanel('image')} type="button"><span className="quiz-tool-icon"><ImageIcon weight="duotone"/></span>AI 그림</button>
        </div>
        {detailPanel === 'etymology' && <div className="quiz-detail-panel"><b><BookOpenIcon weight="duotone"/> 어원 힌트</b><p>{current.etymology ? highlightLearningText(current.etymology, current.word, current.meaning) : '저장된 어원 정보가 아직 없어요.'}</p></div>}
        {detailPanel === 'memory' && <div className="quiz-detail-panel memory"><b><LightbulbIcon weight="duotone"/> 암기 팁</b><p>{current.memoryTip ? highlightLearningText(current.memoryTip, current.word, current.meaning) : '저장된 암기 팁이 아직 없어요.'}</p></div>}
        {detailPanel === 'deep' && <div className="quiz-detail-panel deep">
          {deepAnalysisMutation.isPending && <p className="quiz-ai-status">단어의 뉘앙스를 분석하고 있어요…</p>}
          {deepAnalysisMutation.isError && <p className="quiz-ai-error">{deepAnalysisMutation.error.message}</p>}
          {deepAnalysisMutation.data && deepAnalysisMutation.variables?.itemId === current.id && <>
            <p className="quiz-analysis-section synonyms"><strong className="quiz-analysis-label synonyms"><EqualsIcon weight="duotone" aria-hidden="true"/>유의어</strong> {deepAnalysisMutation.data.synonyms.length ? deepAnalysisMutation.data.synonyms.map((item, index) => <span key={index}>{index > 0 && ', '}<mark className="quiz-learning-highlight">{item.word}</mark> ({item.meaning})</span>) : '뚜렷한 유의어가 없어요.'}</p>
            <p className="quiz-analysis-section antonyms"><strong className="quiz-analysis-label antonyms"><ArrowsLeftRightIcon weight="duotone" aria-hidden="true"/>반의어</strong> {deepAnalysisMutation.data.antonyms.length ? deepAnalysisMutation.data.antonyms.map((item, index) => <span key={index}>{index > 0 && ', '}<mark className="quiz-learning-highlight">{item.word}</mark> ({item.meaning})</span>) : '뚜렷한 반의어가 없어요.'}</p>
            <p className="quiz-analysis-section nuance"><strong className="quiz-analysis-label nuance"><PaletteIcon weight="duotone" aria-hidden="true"/>뉘앙스</strong> {highlightLearningText(deepAnalysisMutation.data.nuance, current.word, current.meaning)}</p>
            <p className="quiz-analysis-section usage"><strong className="quiz-analysis-label usage"><LightbulbIcon weight="duotone" aria-hidden="true"/>사용 팁</strong> {highlightLearningText(deepAnalysisMutation.data.usageTip, current.word, current.meaning)}</p>
          </>}
        </div>}
        {detailPanel === 'image' && <div className="quiz-detail-panel image">
          {imageMutation.isPending && <div className="quiz-ai-image-status"><ImageIcon weight="duotone"/><div><b>AI 그림</b><p>기억에 남을 그림을 만들고 있어요…</p></div></div>}
          {imageMutation.isError && <div className="quiz-ai-image-status"><ImageIcon weight="duotone"/><div><b>AI 그림을 만들지 못했어요</b><p className="quiz-ai-error">{imageMutation.error.message}</p></div></div>}
          {imageMutation.data && imageMutation.variables?.itemId === current.id && <figure><img src={imageMutation.data.imageDataUrl} alt={`${current.word}의 의미를 표현한 AI 학습 그림`}/><figcaption><b>{current.word} · {current.meaning}</b><p>{highlightLearningText(imageMutation.data.explanation, current.word, current.meaning)}</p></figcaption></figure>}
        </div>}
      </section>
    </div>
    {answerMutation.isError && <p className="quiz-answer-error" role="alert">{answerMutation.error.message}</p>}
  </div>
}
