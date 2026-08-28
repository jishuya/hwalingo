import { useEffect, useRef, useState } from 'react'
import { BookOpenIcon, CheckCircleIcon, ImageIcon, LightbulbIcon, MagicWandIcon, SpeakerHighIcon, TranslateIcon, XIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createQuizSession, generateVocabularyImage, getQuizSession, getVocabularyDeepAnalysis, submitQuizAnswer } from '../services/quiz'
import './QuizPage.css'

type DetailPanel = 'etymology' | 'memory' | 'deep' | 'image' | null

const speechLocales: Record<string, string> = { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR' }

export default function QuizPage() {
  const queryClient = useQueryClient()
  const [showSwipeGuide, setShowSwipeGuide] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null)
  const [showExampleTranslation, setShowExampleTranslation] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)
  const questionStartedAt = useRef(0)
  const sessionQuery = useQuery({ queryKey: ['quiz', 'new-session'], queryFn: () => createQuizSession(), retry: false, staleTime: Infinity })
  const session = sessionQuery.data
  const current = session?.items.find(item => !item.result)
  const answeredCount = session?.items.filter(item => item.result).length ?? 0

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
    queryClient.setQueryData(['quiz', 'new-session'], updated)
    resetCard()
  }

  const answerMutation = useMutation({
    mutationFn: (correct: boolean) => submitQuizAnswer(session!.id, current!.id, correct, questionStartedAt.current ? Date.now() - questionStartedAt.current : 0),
    onSuccess: async () => {
      await new Promise(resolve => window.setTimeout(resolve, 180))
      await next()
    },
    onError: () => setDragOffset(0),
  })
  const answerPending = answerMutation.isPending
  const mutateAnswer = answerMutation.mutate
  const deepAnalysisMutation = useMutation({ mutationFn: ({ sessionId, itemId }: { sessionId: string; itemId: string }) => getVocabularyDeepAnalysis(sessionId, itemId) })
  const imageMutation = useMutation({ mutationFn: ({ sessionId, itemId }: { sessionId: string; itemId: string }) => generateVocabularyImage(sessionId, itemId) })

  const grade = (correct: boolean) => {
    if (answerMutation.isPending) return
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
    if (answerMutation.isPending) return
    dragStart.current = event.clientX
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (dragStart.current === null || answerMutation.isPending) return
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
  if (sessionQuery.isError) return <div className="quiz-page page"><div className="empty-state"><h2>테스트를 시작할 수 없어요</h2><p>{sessionQuery.error.message}</p><button className="primary" onClick={() => void sessionQuery.refetch()}>다시 시도</button></div></div>
  if (!session) return null
  if (!current) return <div className="quiz-page page"><section className="card quiz-complete"><CheckCircleIcon weight="fill"/><h1>오늘의 테스트 완료!</h1><p>{session.totalCount}문제 중 <b>{session.correctCount}문제</b>를 기억했어요.</p><strong className="quiz-total-xp">+{session.earnedXp} XP</strong><button className="primary" onClick={() => { queryClient.removeQueries({ queryKey: ['quiz'] }); void sessionQuery.refetch() }}>새 테스트 시작</button></section></div>

  const progress = Math.min(100, ((answeredCount + 1) / session.totalCount) * 100)
  const tilt = Math.max(-7, Math.min(7, dragOffset / 28))

  return <div className="quiz-page quiz-flash-page page">
    {showSwipeGuide && <div className="quiz-swipe-guide-overlay" role="presentation" onPointerDown={() => setShowSwipeGuide(false)}>
      <div className="quiz-swipe-guide" role="dialog" aria-label="테스트 사용 안내" onPointerDown={event => event.stopPropagation()}>
        <button type="button" aria-label="안내 닫기" onClick={() => setShowSwipeGuide(false)}><XIcon weight="bold"/></button>
        <p>아는 단어는 <strong>오른쪽</strong>으로<br/>모르는 단어는 <strong>왼쪽</strong>으로 스와이프하세요.</p>
      </div>
    </div>}
    <div className="quiz-progress"><div><span>오늘의 테스트</span><b>{answeredCount + 1}/{session.totalCount}</b></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div></div>
    <div className="quiz-swipe-stage">
      <section className={`quiz-flash-card card ${revealed ? 'revealed' : ''} ${dragging ? 'dragging' : ''} ${dragOffset < -15 ? 'swipe-wrong' : dragOffset > 15 ? 'swipe-correct' : ''}`} style={{ transform: `translateX(${dragOffset}px) rotate(${tilt}deg)` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {current.cefrLevel && <span className={`quiz-level level-${current.cefrLevel.toLowerCase()}`}>Lv.{current.cefrLevel}</span>}
        <button className="quiz-word-reveal" type="button" onClick={toggleMeaning} aria-label={revealed ? `${current.word} 뜻 숨기기` : `${current.word} 뜻 보기`} aria-pressed={revealed}>
          <strong>{current.word}</strong>
          {!revealed && <small>단어를 눌러 뜻을 확인하세요</small>}
          {revealed && <span className="quiz-meaning">{current.meaning}</span>}
        </button>
        <button className="quiz-sound" type="button" onClick={event => { event.stopPropagation(); speak() }} aria-label={`${current.word} 발음 듣기`}><SpeakerHighIcon weight="fill"/></button>
        <div className="quiz-example"><div><b>EXAMPLE</b>{current.exampleTranslation && <button type="button" className={showExampleTranslation ? 'active' : ''} aria-label={`예문 해석 ${showExampleTranslation ? '숨기기' : '보기'}`} aria-pressed={showExampleTranslation} onClick={() => setShowExampleTranslation(value => !value)}><TranslateIcon/></button>}</div><p>{current.exampleSentence || '저장된 예문이 아직 없어요.'}</p>{showExampleTranslation && current.exampleTranslation && <p className="quiz-example-translation">{current.exampleTranslation}</p>}</div>
        <div className="quiz-detail-tabs">
          <button className={detailPanel === 'etymology' ? 'active' : ''} onClick={() => togglePanel('etymology')} type="button"><BookOpenIcon weight="fill"/>어원 힌트</button>
          <button className={detailPanel === 'memory' ? 'active' : ''} onClick={() => togglePanel('memory')} type="button"><LightbulbIcon weight="fill"/>암기 팁</button>
          <button className={detailPanel === 'deep' ? 'active deep' : 'deep'} onClick={() => togglePanel('deep')} type="button"><MagicWandIcon weight="fill"/>AI 심화</button>
          <button className={detailPanel === 'image' ? 'active image' : 'image'} onClick={() => togglePanel('image')} type="button"><ImageIcon weight="fill"/>AI 그림</button>
        </div>
        {detailPanel === 'etymology' && <div className="quiz-detail-panel"><b><BookOpenIcon/> 어원 힌트</b><p>{current.etymology || '저장된 어원 정보가 아직 없어요.'}</p></div>}
        {detailPanel === 'memory' && <div className="quiz-detail-panel memory"><b><LightbulbIcon/> 암기 팁</b><p>{current.memoryTip || '저장된 암기 팁이 아직 없어요.'}</p></div>}
        {detailPanel === 'deep' && <div className="quiz-detail-panel deep"><b><MagicWandIcon/> AI 심화 분석</b>
          {deepAnalysisMutation.isPending && <p className="quiz-ai-status">단어의 뉘앙스를 분석하고 있어요…</p>}
          {deepAnalysisMutation.isError && <p className="quiz-ai-error">{deepAnalysisMutation.error.message}</p>}
          {deepAnalysisMutation.data && deepAnalysisMutation.variables?.itemId === current.id && <>
            <p><strong>유의어:</strong> {deepAnalysisMutation.data.synonyms.length ? deepAnalysisMutation.data.synonyms.map(item => `${item.word} (${item.meaning})`).join(', ') : '뚜렷한 유의어가 없어요.'}</p>
            <p><strong>반의어:</strong> {deepAnalysisMutation.data.antonyms.length ? deepAnalysisMutation.data.antonyms.map(item => `${item.word} (${item.meaning})`).join(', ') : '뚜렷한 반의어가 없어요.'}</p>
            <p><strong>뉘앙스:</strong> {deepAnalysisMutation.data.nuance}</p>
            <p><strong>사용 팁:</strong> {deepAnalysisMutation.data.usageTip}</p>
          </>}
        </div>}
        {detailPanel === 'image' && <div className="quiz-detail-panel image">
          {imageMutation.isPending && <div className="quiz-ai-image-status"><ImageIcon weight="duotone"/><div><b>AI 그림</b><p>기억에 남을 그림을 만들고 있어요…</p></div></div>}
          {imageMutation.isError && <div className="quiz-ai-image-status"><ImageIcon weight="duotone"/><div><b>AI 그림을 만들지 못했어요</b><p className="quiz-ai-error">{imageMutation.error.message}</p></div></div>}
          {imageMutation.data && imageMutation.variables?.itemId === current.id && <figure><img src={imageMutation.data} alt={`${current.word}의 의미를 표현한 AI 학습 그림`}/><figcaption>{current.word} · {current.meaning}</figcaption></figure>}
        </div>}
      </section>
    </div>
    {answerMutation.isError && <p className="quiz-answer-error" role="alert">{answerMutation.error.message}</p>}
  </div>
}
