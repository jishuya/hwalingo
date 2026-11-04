import AnalyticsPeriod, { AnalyticsPeriodControls } from './AnalyticsPeriod'
import { useAnalyticsPeriod } from './analyticsContext'
import { formatAnalyticsDate } from '../../services/analytics'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpenIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { getLearningVolume } from '../../services/progress'
import './LearningVolumeChart.css'

const number = (value: number) => value.toLocaleString('ko-KR')
function LearningVolumeChartContent() {
  const { selection } = useAnalyticsPeriod()
  const query = useQuery({ queryKey: ['progress', 'activity', selection], queryFn: () => getLearningVolume(selection), refetchInterval: 20_000 })
  const dateLabel = (date: string) => formatAnalyticsDate(date,query.data?.range?.grain)
  const [selectedDate, setSelectedDate] = useState<string>()
  const days = query.data?.days ?? []
  const today = days.at(-1)
  const selected = days.find(day => day.date === selectedDate) ?? today
  const newTotal = days.reduce((sum, day) => sum + day.newAnswers, 0)
  const reviewTotal = days.reduce((sum, day) => sum + day.reviewAnswers, 0)
  const maximum = Math.max(5, ...days.map(day => day.newAnswers + day.reviewAnswers))
  const ceiling = Math.ceil(maximum / 5) * 5
  const selectedTotal = selected ? selected.newAnswers + selected.reviewAnswers : 0

  return <section className="card learning-volume-card" aria-labelledby="learning-volume-title">
    <div className="learning-volume-heading report-chart-heading"><div><h2 id="learning-volume-title"><BookOpenIcon weight="duotone" aria-hidden="true"/> 학습량</h2></div><button className="learning-volume-refresh report-chart-refresh" type="button" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="학습량 새로고침"><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>
    <AnalyticsPeriodControls/>
    {query.isPending ? <p role="status">학습량을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>학습량을 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <div className="learning-volume-summary"><div className="volume-total"><span>총 단어</span><strong>{number(newTotal + reviewTotal)}<small>문제</small></strong></div><div className="volume-new"><span>새단어</span><strong>{number(newTotal)}<small>문제</small></strong></div><div className="volume-review"><span>복습단어</span><strong>{number(reviewTotal)}<small>문제</small></strong></div></div>
          <div className="analytics-chart-scroll"><div className="learning-volume-plot" style={{minWidth: days.length > 14 ? days.length*44+38 : undefined}}><div className="learning-volume-axis" aria-hidden="true"><span>{number(ceiling)}</span><span>{number(ceiling / 2)}</span><span>0</span></div><div className="learning-volume-bars" style={{gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`}} role="group" aria-label="선택 기간 새 단어와 복습 문제 수, 단위 문제">
            {days.map(day => <button key={day.date} type="button" className={selected?.date === day.date ? 'selected' : ''} aria-pressed={selected?.date === day.date} aria-label={`${dateLabel(day.date)}, 새 단어 ${day.newAnswers}문제, 복습 ${day.reviewAnswers}문제`} onClick={() => setSelectedDate(day.date)}><span className="learning-volume-track"><span className="learning-volume-stack" style={{ height: `${(day.newAnswers + day.reviewAnswers) / ceiling * 100}%` }}><span className="new" style={{ flex: day.newAnswers }}/><span className="review" style={{ flex: day.reviewAnswers }}/></span>{day.newAnswers + day.reviewAnswers === 0 && <span className="learning-volume-zero">0</span>}</span><span className="learning-volume-day">{day.date === query.data?.range?.today && query.data?.range?.grain === 'day' ? '오늘' : dateLabel(day.date)}</span></button>)}
          </div></div>
          </div>
          <div className="learning-volume-legend"><span><i className="new"/>새 단어 {number(newTotal)}문제</span><span><i className="review"/>복습 {number(reviewTotal)}문제</span></div>
          {selected && <div className="learning-volume-detail learning-time-details" aria-live="polite">
            <div className="learning-time-record">
              <div className="learning-time-record-header"><span className="learning-time-record-date">{query.data.range?.grain==='month'?`${selected.date.slice(0,4)}년 ${Number(selected.date.slice(5,7))}월`:query.data.range?.grain==='year'?`${selected.date.slice(0,4)}년`:`${Number(selected.date.slice(5,7))}월 ${Number(selected.date.slice(8,10))}일`}</span></div>
              <div className="learning-time-record-copy"><p><span>총 단어</span><strong>{number(selectedTotal)}문제</strong></p>
                <small className="learning-time-record-activities"><span>새단어 {number(selected.newAnswers)}문제</span><span>복습단어 {number(selected.reviewAnswers)}문제</span></small>
              </div>
            </div>
            <dl className="learning-time-averages"><div><dt>학습한 단어</dt><dd>{number(selected.uniqueWords)}개</dd></div><div><dt>첫 시도 정답률</dt><dd>{selectedTotal ? `${Math.round(selected.correctAnswers / selectedTotal * 100)}%` : '기록 없음'}</dd></div></dl>
          </div>}
          {query.isError && <p role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
  </section>
}

export default function LearningVolumeChart() {
  return <AnalyticsPeriod><LearningVolumeChartContent/></AnalyticsPeriod>
}
