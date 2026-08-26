import { useRef, useState } from 'react'
import { BookOpenIcon, CheckCircleIcon, ImageIcon, LightbulbIcon, MagicWandIcon, SpeakerHighIcon, TranslateIcon, XIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createQuizSession, getQuizSession, submitQuizAnswer } from '../services/quiz'

type DetailPanel = 'etymology' | 'memory' | 'deep' | 'image' | null

const speechLocales: Record<string, string> = { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR' }

export default function QuizPage() {
  const queryClient = useQueryClient()
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
    questionStartedAt.current = Date.now()
  }

  const next = async () => {
    if (!session) return
    const updated = await queryClient.fetchQuery({ queryKey: ['quiz', 'session', session.id], queryFn: () => getQuizSession(session.id) })
    queryClient.setQueryData(['quiz', 'new-session'], updated)
    resetCard()
  }

  const answerMutation = useMutation({
    mutationFn: (correct: boolean) => submitQuizAnswer(session!.id, current!.id, correct, Date.now() - questionStartedAt.current),
    onSuccess: async () => {
      await new Promise(resolve => window.setTimeout(resolve, 180))
      await next()
    },
    onError: () => setDragOffset(0),
  })

  const grade = (correct: boolean) => {
    if (!revealed || answerMutation.isPending) return
    setDragOffset(correct ? window.innerWidth : -window.innerWidth)
    answerMutation.mutate(correct)
  }

  const speak = () => {
    if (!current || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(current.word)
    utterance.lang = speechLocales[current.languageCode] ?? current.languageCode
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  const togglePanel = (panel: Exclude<DetailPanel, null>) => setDetailPanel(previous => previous === panel ? null : panel)
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!revealed || answerMutation.isPending) return
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
    <div className="quiz-progress"><div><span>오늘의 테스트</span><b>{answeredCount + 1}/{session.totalCount}</b></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div></div>
    <div className="quiz-swipe-stage">
      <span className={`swipe-verdict wrong ${dragOffset < -35 ? 'visible' : ''}`}><XIcon weight="bold"/> 몰라요</span>
      <span className={`swipe-verdict correct ${dragOffset > 35 ? 'visible' : ''}`}><CheckCircleIcon weight="bold"/> 알아요</span>
      <section className={`quiz-flash-card card ${revealed ? 'revealed' : ''} ${dragging ? 'dragging' : ''}`} style={{ transform: `translateX(${dragOffset}px) rotate(${tilt}deg)` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {current.cefrLevel && <span className="quiz-level">Level: {current.cefrLevel}</span>}
        <button className="quiz-word-reveal" type="button" onClick={() => { if (!revealed) questionStartedAt.current = Date.now(); setRevealed(true) }} aria-label={revealed ? `${current.word}, 뜻 공개됨` : `${current.word} 뜻 보기`}>
          <strong>{current.word}</strong>
          {!revealed && <small>단어를 눌러 뜻을 확인하세요</small>}
          {revealed && <span className="quiz-meaning">{current.meaning}</span>}
        </button>
        <button className="quiz-sound" type="button" onClick={event => { event.stopPropagation(); speak() }} aria-label={`${current.word} 발음 듣기`}><SpeakerHighIcon weight="fill"/></button>
        <div className="quiz-example"><div><b>EXAMPLE</b>{current.exampleTranslation && <button type="button" className={showExampleTranslation ? 'active' : ''} aria-label={`예문 해석 ${showExampleTranslation ? '숨기기' : '보기'}`} aria-pressed={showExampleTranslation} onClick={() => setShowExampleTranslation(value => !value)}><TranslateIcon/> 해석</button>}</div><p>{current.exampleSentence || '저장된 예문이 아직 없어요.'}</p>{showExampleTranslation && current.exampleTranslation && <p className="quiz-example-translation">{current.exampleTranslation}</p>}</div>
        <div className="quiz-detail-tabs">
          <button className={detailPanel === 'etymology' ? 'active' : ''} onClick={() => togglePanel('etymology')} type="button"><BookOpenIcon weight="fill"/>어원 힌트</button>
          <button className={detailPanel === 'memory' ? 'active' : ''} onClick={() => togglePanel('memory')} type="button"><LightbulbIcon weight="fill"/>암기 팁</button>
          <button className={detailPanel === 'deep' ? 'active deep' : 'deep'} onClick={() => togglePanel('deep')} type="button"><MagicWandIcon weight="fill"/>AI 심화</button>
          <button className={detailPanel === 'image' ? 'active image' : 'image'} onClick={() => togglePanel('image')} type="button"><ImageIcon weight="fill"/>AI 그림</button>
        </div>
        {detailPanel === 'etymology' && <div className="quiz-detail-panel"><b><BookOpenIcon/> 어원 힌트</b><p>{current.etymology || '저장된 어원 정보가 아직 없어요.'}</p></div>}
        {detailPanel === 'memory' && <div className="quiz-detail-panel memory"><b><LightbulbIcon/> 암기 팁</b><p>{current.memoryTip || '저장된 암기 팁이 아직 없어요.'}</p></div>}
        {detailPanel === 'deep' && <div className="quiz-detail-panel deep"><b><MagicWandIcon/> AI 심화 분석</b><p><strong>유의어:</strong> AI 분석 데이터가 아직 없어요.</p><p><strong>반의어:</strong> AI 분석 데이터가 아직 없어요.</p><p><strong>뉘앙스 노트:</strong> {current.contextMeaning || 'AI 분석 데이터가 아직 없어요.'}</p></div>}
        {detailPanel === 'image' && <div className="quiz-detail-panel image"><ImageIcon weight="duotone"/><div><b>AI 그림</b><p>이 단어에 연결된 AI 그림이 아직 없어요.</p></div></div>}
      </section>
    </div>
    {revealed ? <div className="quiz-grade-actions"><button type="button" onClick={() => grade(false)} disabled={answerMutation.isPending}><XIcon weight="bold"/>몰랐어요 <small>왼쪽으로 스와이프</small></button><button type="button" onClick={() => grade(true)} disabled={answerMutation.isPending}><CheckCircleIcon weight="bold"/>알았어요 <small>오른쪽으로 스와이프</small></button></div> : <p className="quiz-reveal-guide">먼저 뜻을 떠올린 다음 단어를 눌러보세요.</p>}
    {answerMutation.isError && <p className="quiz-answer-error" role="alert">{answerMutation.error.message}</p>}
  </div>
}
