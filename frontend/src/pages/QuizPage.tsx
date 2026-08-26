import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon, CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createQuizSession, getQuizSession, submitQuizAnswer, type AnswerResult } from '../services/quiz'

export default function QuizPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [lastResult, setLastResult] = useState<AnswerResult>()
  const questionStartedAt = useRef(0)
  const sessionQuery = useQuery({
    queryKey: ['quiz', 'new-session'],
    queryFn: () => createQuizSession(),
    retry: false,
    staleTime: Infinity,
  })
  const session = sessionQuery.data
  const current = session?.items.find(item => !item.result)
  const answeredCount = session?.items.filter(item => item.result).length ?? 0
  const answerMutation = useMutation({
    mutationFn: (answer: string) => submitQuizAnswer(session!.id, current!.id, answer, Date.now() - questionStartedAt.current),
    onSuccess: result => setLastResult(result),
  })

  useEffect(() => {
    questionStartedAt.current = Date.now()
  }, [current?.id])

  const submit = (answer = input) => {
    if (!answer.trim() || answerMutation.isPending || lastResult) return
    answerMutation.mutate(answer.trim())
  }
  const next = async () => {
    if (!session) return
    const updated = await queryClient.fetchQuery({ queryKey: ['quiz', 'session', session.id], queryFn: () => getQuizSession(session.id) })
    queryClient.setQueryData(['quiz', 'new-session'], updated)
    setInput('')
    setLastResult(undefined)
    questionStartedAt.current = Date.now()
  }

  if (sessionQuery.isPending) return <div className="quiz-page page"><div className="empty-state"><p>오늘의 테스트를 준비하고 있어요.</p></div></div>
  if (sessionQuery.isError) return <div className="quiz-page page"><div className="empty-state"><h2>테스트를 시작할 수 없어요</h2><p>{sessionQuery.error.message}</p><button className="primary" onClick={() => void sessionQuery.refetch()}>다시 시도</button></div></div>
  if (!session) return null

  if (!current && !lastResult) return <div className="quiz-page page"><section className="card quiz-complete"><CheckCircleIcon weight="fill"/><h1>오늘의 테스트 완료!</h1><p>{session.totalCount}문제 중 <b>{session.correctCount}문제</b>를 맞혔어요.</p><strong className="quiz-total-xp">+{session.earnedXp} XP</strong><button className="primary" onClick={() => { queryClient.removeQueries({ queryKey: ['quiz'] }); void sessionQuery.refetch() }}>새 테스트 시작</button></section></div>

  const visibleItem = current ?? session.items[answeredCount - 1]
  const progress = Math.min(100, ((answeredCount + (lastResult ? 0 : 1)) / session.totalCount) * 100)

  return <div className="quiz-page page">
    <div className="quiz-progress"><div><span>오늘의 테스트</span><b>{Math.min(answeredCount + 1, session.totalCount)}/{session.totalCount}</b></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div></div>
    <section className="quiz-question-card card">
      <div className="quiz-question-meta"><span>{visibleItem.questionType === 'multiple_choice' ? '객관식' : visibleItem.questionType === 'context' ? '문맥 빈칸' : visibleItem.questionType === 'translation' ? '번역하기' : '직접 입력'}</span>{visibleItem.generationSource === 'ai' && <em>AI</em>}{visibleItem.cefrLevel && <b>{visibleItem.cefrLevel}</b>}</div>
      <h1>{visibleItem.prompt}</h1>
      {visibleItem.questionType === 'multiple_choice'
        ? <div className="quiz-choice-list">{visibleItem.choices.map(choice => <button disabled={Boolean(lastResult)} onClick={() => submit(choice)} key={choice}>{choice}</button>)}</div>
        : <div className="answer-box"><input autoFocus value={input} disabled={Boolean(lastResult)} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && submit()} placeholder="정답을 입력하세요"/><button disabled={!input.trim() || Boolean(lastResult)} onClick={() => submit()}>확인</button></div>}
      {answerMutation.isError && <p className="quiz-answer-error" role="alert">{answerMutation.error.message}</p>}
      {lastResult && <><div className={`quiz-result-panel ${lastResult.correct ? 'correct' : 'incorrect'}`}>{lastResult.correct ? <CheckCircleIcon weight="fill"/> : <XCircleIcon weight="fill"/>}<div><strong>{lastResult.correct ? `정답이에요! +${lastResult.xpEarned} XP` : '조금 더 기억을 강화해 볼까요?'}</strong>{!lastResult.correct && <p>정답: {lastResult.correctAnswer}</p>}{lastResult.questionExplanation && <p>{lastResult.questionExplanation}</p>}<span>숙련도 Lv.{lastResult.mastery.before} → Lv.{lastResult.mastery.after} · {lastResult.growth.rank} Lv.{lastResult.growth.level}</span>{lastResult.growth.rankedUp && <b>새로운 랭크를 달성했어요!</b>}{!lastResult.growth.rankedUp && lastResult.growth.leveledUp && <b>레벨 업!</b>}</div><button onClick={() => void next()} aria-label="다음 문제"><ArrowRightIcon weight="bold"/></button></div>{lastResult.aiFeedback && <div className="ai-wrong-feedback"><strong>AI 오답 분석 · {lastResult.aiFeedback.confusionType}</strong><p>{lastResult.aiFeedback.feedback}</p><span>💡 {lastResult.aiFeedback.tip}</span></div>}</>}
    </section>
  </div>
}
