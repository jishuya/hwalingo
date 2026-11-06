import ChartStaleNotice from './ChartStaleNotice'
import ChartErrorState from './ChartErrorState'
import ReportSummary from './ReportSummary'
import { useState } from 'react'
import AnalyticsPeriod, { AnalyticsPeriodControls } from './AnalyticsPeriod'
import { useAnalyticsPeriod } from './analyticsContext'
import { formatAnalyticsDate } from '../../services/analytics'
import { useQuery } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, ChecksIcon } from '@phosphor-icons/react'
import { getRelearningProgress } from '../../services/progress'
import './LearningRelearningChart.css'

function LearningRelearningContent({ onStandard, onIncorrect }: { onStandard: () => void; onIncorrect: () => void }) {
  const { selection } = useAnalyticsPeriod()
  const query = useQuery({ queryKey: ['progress', 'relearning', selection], queryFn: () => getRelearningProgress(selection), refetchInterval: 20_000 })
  const label = (date:string) => formatAnalyticsDate(date,query.data?.range?.grain)
  const [selectedDate,setSelectedDate] = useState<string>()
  const days = query.data?.days ?? []
  const selected = days.find(day=>day.date===selectedDate)??days.at(-1)
  const completed = days.reduce((sum, day) => sum + day.completed, 0)
  const remaining = days.reduce((sum, day) => sum + day.remaining, 0)
  const unavailable = days.reduce((sum, day) => sum + day.unavailable, 0)
  const standard = days.reduce((sum, day) => sum + day.standardRemaining, 0)
  const incorrect = days.reduce((sum, day) => sum + day.incorrectRemaining, 0)
  const total = completed + remaining + unavailable

  return <section className="card learning-relearning-card" aria-labelledby="learning-relearning-title">
    <div className="learning-relearning-heading report-chart-heading"><div><h2 id="learning-relearning-title"><ChecksIcon weight="duotone" aria-hidden="true"/> 오답 재학습 완료</h2></div><button type="button" className="learning-relearning-refresh report-chart-refresh" aria-label="오답 재학습 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>
    <AnalyticsPeriodControls/>
    {query.isPending ? <p role="status">재학습 기록을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <ChartErrorState message="재학습 기록을 불러오지 못했어요." retrying={query.isFetching} onRetry={() => void query.refetch()}/>
        : query.data && <>
          <ReportSummary className="learning-relearning-summary" items={[
            {label:'전체 오답',value:total.toLocaleString('ko-KR'),unit:'문제',tone:'neutral'},
            {label:'재학습 완료',value:completed.toLocaleString('ko-KR'),unit:'문제'},
            {label:'남은 재도전',value:remaining.toLocaleString('ko-KR'),unit:'문제',tone:'amber'},
          ]}/>

          <div className="learning-relearning-total-bar" role="img" aria-label={`오답 ${total}문제 중 재학습 완료 ${completed}문제, 남은 재도전 ${remaining}문제, 확인 또는 재개 불가 ${unavailable}문제`}><span className="completed" style={{ width: `${total ? completed / total * 100 : 0}%` }}/><span className="remaining" style={{ width: `${total ? remaining / total * 100 : 0}%` }}/><span className="unavailable" style={{ width: `${total ? unavailable / total * 100 : 0}%` }}/></div>
          <div className="learning-relearning-days">{days.map(day => {
            const count = day.completed + day.remaining + day.unavailable
            return <button type="button" key={day.date} aria-pressed={selected?.date===day.date} onClick={()=>setSelectedDate(day.date)}><span>{day.date === query.data?.range?.today && query.data?.range?.grain==='day' ? '오늘' : label(day.date)}</span><div role="img" aria-label={`${label(day.date)}에 처음 틀린 ${count}문제 중 완료 ${day.completed}, 남은 재도전 ${day.remaining}, 확인 또는 재개 불가 ${day.unavailable}`}><i className="completed" style={{ width: `${count ? day.completed / count * 100 : 0}%` }}/><i className="remaining" style={{ width: `${count ? day.remaining / count * 100 : 0}%` }}/><i className="unavailable" style={{ width: `${count ? day.unavailable / count * 100 : 0}%` }}/></div><strong>{count ? `${day.completed}/${count}문제` : '오답 없음'}</strong></button>
          })}</div>
          <div className="learning-relearning-legend"><span><i className="completed"/>완료 {completed}문제</span><span><i className="remaining"/>남은 재도전 {remaining}문제</span><span><i className="unavailable"/>확인·재개 불가 {unavailable}문제</span></div>
          {selected&&<div className="report-detail learning-time-details" aria-live="polite">
            <div className="learning-time-record"><div className="learning-time-record-header"><span className="learning-time-record-date">{label(selected.date)}</span></div><div className="learning-time-record-copy"><p><span>재학습 완료</span><strong>{selected.completed.toLocaleString('ko-KR')}문제</strong></p></div></div>
            <dl className="learning-time-averages"><div><dt>남은 재도전</dt><dd>{selected.remaining.toLocaleString('ko-KR')}문제</dd></div><div><dt>확인·재개 불가</dt><dd>{selected.unavailable.toLocaleString('ko-KR')}문제</dd></div></dl>
          </div>}
          {!total && <p className="learning-relearning-message">선택 기간에는 처음 틀린 문제 기록이 없어요.</p>}
          {total > 0 && completed === total && <p className="learning-relearning-message">틀린 문제를 모두 다시 맞혔어요. 끝까지 학습했네요!</p>}
          {(standard > 0 || incorrect > 0) && <div className="learning-relearning-actions">{standard > 0 && <button type="button" className="primary" onClick={onStandard}><ChecksIcon weight="fill"/>일반 테스트 이어하기</button>}{incorrect > 0 && <button type="button" className="primary" onClick={onIncorrect}><ChecksIcon weight="fill"/>오답 테스트 이어하기</button>}</div>}

          {query.isError && <ChartStaleNotice/>}
        </>}
  </section>
}

export default function LearningRelearningChart(props: { onStandard: () => void; onIncorrect: () => void }) {
  return <AnalyticsPeriod><LearningRelearningContent {...props}/></AnalyticsPeriod>
}
