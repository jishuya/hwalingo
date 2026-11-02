import { useAnalyticsPeriod } from './analyticsContext'
import { formatAnalyticsDate } from '../../services/analytics'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon, ChecksIcon } from '@phosphor-icons/react'
import { getRelearningProgress } from '../../services/progress'
import './LearningRelearningChart.css'

export default function LearningRelearningChart({ onStandard, onIncorrect }: { onStandard: () => void; onIncorrect: () => void }) {
  const { selection, label: periodLabel } = useAnalyticsPeriod()
  const query = useQuery({ queryKey: ['progress', 'relearning', selection], queryFn: () => getRelearningProgress(selection), refetchInterval: 20_000 })
  const label = (date:string) => formatAnalyticsDate(date,query.data?.range?.grain)
  const days = query.data?.days ?? []
  const completed = days.reduce((sum, day) => sum + day.completed, 0)
  const remaining = days.reduce((sum, day) => sum + day.remaining, 0)
  const unavailable = days.reduce((sum, day) => sum + day.unavailable, 0)
  const standard = days.reduce((sum, day) => sum + day.standardRemaining, 0)
  const incorrect = days.reduce((sum, day) => sum + day.incorrectRemaining, 0)
  const total = completed + remaining + unavailable
  const percent = total ? Math.round(completed / total * 100) : null

  return <section className="card learning-relearning-card" aria-labelledby="learning-relearning-title">
    <div className="learning-relearning-heading"><div><span className="learning-relearning-eyebrow"><ChecksIcon weight="duotone"/> 틀려도 다시 배우면 돼요</span><h2 id="learning-relearning-title">오답 재학습 완료</h2><p>{periodLabel}에 처음 틀린 문제 · 현재 재도전 상태</p></div><button type="button" className="learning-relearning-refresh" aria-label="오답 재학습 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowClockwiseIcon/>새로고침</button></div>
    {query.isPending ? <p role="status">재학습 기록을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>재학습 기록을 불러오지 못했어요.</p><button type="button" className="primary" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <div className="learning-relearning-summary"><div><span>처음 틀린 {total.toLocaleString('ko-KR')}문제 중</span><strong>{completed.toLocaleString('ko-KR')}문제 재학습 완료</strong></div><b>{percent === null ? '–' : `${percent}%`}</b></div>
          <div className="learning-relearning-total-bar" role="img" aria-label={`오답 ${total}문제 중 재학습 완료 ${completed}문제, 남은 재도전 ${remaining}문제, 확인 또는 재개 불가 ${unavailable}문제`}><span className="completed" style={{ width: `${total ? completed / total * 100 : 0}%` }}/><span className="remaining" style={{ width: `${total ? remaining / total * 100 : 0}%` }}/><span className="unavailable" style={{ width: `${total ? unavailable / total * 100 : 0}%` }}/></div>
          <div className="learning-relearning-legend"><span><i className="completed"/>완료 {completed}문제</span><span><i className="remaining"/>남은 재도전 {remaining}문제</span><span><i className="unavailable"/>확인·재개 불가 {unavailable}문제</span></div>
          <div className="learning-relearning-days">{days.map(day => {
            const count = day.completed + day.remaining + day.unavailable
            return <div key={day.date}><span>{day.date === query.data?.range?.today && query.data?.range?.grain==='day' ? '오늘' : label(day.date)}</span><div role="img" aria-label={`${label(day.date)}에 처음 틀린 ${count}문제 중 완료 ${day.completed}, 남은 재도전 ${day.remaining}, 확인 또는 재개 불가 ${day.unavailable}`}><i className="completed" style={{ width: `${count ? day.completed / count * 100 : 0}%` }}/><i className="remaining" style={{ width: `${count ? day.remaining / count * 100 : 0}%` }}/><i className="unavailable" style={{ width: `${count ? day.unavailable / count * 100 : 0}%` }}/></div><strong>{count ? `${day.completed}/${count}문제` : '오답 없음'}</strong></div>
          })}</div>
          {!total && <p className="learning-relearning-message">선택 기간에는 처음 틀린 문제 기록이 없어요.</p>}
          {total > 0 && completed === total && <p className="learning-relearning-message">틀린 문제를 모두 다시 맞혔어요. 끝까지 학습했네요!</p>}
          {(standard > 0 || incorrect > 0) && <div className="learning-relearning-actions">{standard > 0 && <button type="button" className="primary" onClick={onStandard}><ChecksIcon weight="fill"/>일반 테스트 이어하기</button>}{incorrect > 0 && <button type="button" className="primary" onClick={onIncorrect}><ChecksIcon weight="fill"/>오답 테스트 이어하기</button>}</div>}
          <p className="learning-relearning-note">같은 테스트의 재도전에서 정답을 맞히면 원래 오답 1문제를 완료로 계산해요. 같은 단어라도 다른 테스트에서 틀리면 별도 문제예요. 재도전은 첫 시도 정답률을 바꾸지 않아요.</p><p className="learning-relearning-note">재도전 이력이 없는 과거 기록, 삭제된 단어의 미완료 문제, 중단된 테스트는 확인·재개 불가로 구분해요. 날짜는 첫 오답을 제출한 한국 시간 기준이에요.</p>
          {query.isError && <p role="status" className="learning-relearning-note">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
  </section>
}
