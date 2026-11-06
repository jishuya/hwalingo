import ChartErrorState from './ChartErrorState'
import AnalyticsPeriod, { AnalyticsPeriodControls } from './AnalyticsPeriod'
import { useAnalyticsPeriod } from './analyticsContext'
import { formatAnalyticsDate } from '../../services/analytics'
import { useState } from 'react'
import { ClockIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../services/auth'
import { flushLearningTime, getLearningTime, type LearningActivity } from '../../services/learningTime'
import './LearningTimeChart.css'

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  if (seconds > 0 && whole === 0) return '1초 미만'
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = whole % 60
  return [hours ? `${hours}시간` : '', minutes ? `${minutes}분` : '', rest ? `${rest}초` : ''].filter(Boolean).join(' ') || '0분'
}

function LearningTimeChartContent() {
  const { selection } = useAnalyticsPeriod()
  const auth = useQuery({ queryKey: ['auth', 'me'], queryFn: getCurrentUser })
  const userId = auth.data?.user.id
  const query = useQuery({
    queryKey: ['learning-time', userId, selection],
    queryFn: async () => {
      await flushLearningTime(userId!)
      return getLearningTime(selection)
    },
    enabled: Boolean(userId),
    refetchInterval: 20_000,
  })
  const dateLabel = (date: string) => formatAnalyticsDate(date,query.data?.range?.grain)
  const [selectedDate, setSelectedDate] = useState<string>()
  const data = query.data
  const days = data?.days ?? []
  const today = days.at(-1)
  const activities: Array<{key:LearningActivity;label:string}> = [{key:'analysis',label:'문장 분석'},{key:'vocabulary',label:'단어 학습'},{key:'quiz',label:'테스트'},{key:'story',label:'스토리'}]
  const measuredDays = days.filter(day => day.measuredDays > 0)
  const total = measuredDays.reduce((sum, day) => sum + day.seconds, 0)
  const activeDays = measuredDays.reduce((sum,day) => sum + day.activeDays,0)
  const measuredCount = measuredDays.reduce((sum,day) => sum + day.measuredDays,0)
  const maximum = Math.max(60, ...days.map(day => day.seconds))
  const ceiling = Math.ceil(maximum / 60) * 60
  const selected = days.find(day => day.date === selectedDate) ?? today
  const recordDateLabel = selected ? data?.range?.grain === 'month'
    ? `${Number(selected.date.slice(0,4))}년 ${Number(selected.date.slice(5,7))}월`
    : data?.range?.grain === 'year'
      ? `${Number(selected.date.slice(0,4))}년`
      : `${Number(selected.date.slice(5,7))}월 ${Number(selected.date.slice(8,10))}일` : ''

  return <section className="card learning-time-card" aria-labelledby="learning-time-title">
    <div className="learning-time-heading report-chart-heading">
      <div><h2 id="learning-time-title"><ClockIcon weight="duotone" aria-hidden="true"/> 학습 시간</h2></div>
      <button type="button" className="learning-time-refresh report-chart-refresh" onClick={() => void query.refetch()} disabled={query.isFetching || !userId} aria-label="학습 시간 새로고침" title="새로고침"><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button>
    </div>
    <AnalyticsPeriodControls/>
    {query.isPending ? <p role="status">학습 시간을 불러오는 중이에요.</p>
      : query.isError && !data ? <ChartErrorState message="학습 시간을 불러오지 못했어요." retrying={query.isFetching} onRetry={() => void query.refetch()}/>
        : data && <>
          <div className="learning-time-totals">
            <div><span>{data.range?.grain==='day'&&today?.date===data.range?.today?'오늘 학습':'마지막 구간 학습'}</span><strong>{formatTime(today?.seconds ?? 0)}</strong></div>
            <div><span>선택 기간 합계</span><strong>{formatTime(total)}</strong></div>
          </div>
          <div className="analytics-chart-scroll"><div className="learning-time-plot" style={{minWidth: days.length > 14 ? days.length*44+46 : undefined}}>
            <div className="learning-time-axis" aria-hidden="true"><span>{Math.round(ceiling / 60)}분</span><span>{Number((ceiling / 120).toFixed(1))}분</span><span>0분</span></div>
            <div className="learning-time-bars" style={{gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`}} role="group" aria-label="선택 기간 구간별 학습 시간">
              {days.map(day => {
                const before = day.measuredDays === 0
                const label = day.date === data?.range?.today && data?.range?.grain === 'day' ? '오늘' : dateLabel(day.date)
                return <button key={day.date} type="button" className={`${before ? 'before-measurement' : ''} ${selected?.date === day.date ? 'selected' : ''}`} onClick={() => setSelectedDate(day.date)} aria-pressed={selected?.date === day.date} aria-label={`${dateLabel(day.date)}, ${before ? '측정 전' : formatTime(day.seconds)}`}>
                  <span className="learning-time-bar-track"><span className="learning-time-bar analytics-time-stack" style={{ height: `${before ? 0 : day.seconds / ceiling * 100}%` }}>{activities.map(activity=><i key={activity.key} className={`time-${activity.key}`} style={{flex:day.byActivity[activity.key]}}/>)}</span>{(before || day.seconds === 0) && <span className="learning-time-zero">{before ? '–' : '0'}</span>}</span>
                  <span className="learning-time-day">{label}</span>
                  {selected?.date===day.date && day.seconds>0 && <span className="learning-time-bar-value" style={{bottom:`calc(34px + (100% - 34px) * ${day.seconds/ceiling} + 6px)`}}>{formatTime(day.seconds)}</span>}
                </button>
              })}
            </div>
          </div>
          </div>
          <div className="analytics-time-legend">{activities.map(activity=><span key={activity.key}><i className={`time-${activity.key}`}/>{activity.label}</span>)}</div>
          <div className="learning-time-details">
          {selected && <div className="learning-time-record" aria-live="polite">
            <div className="learning-time-record-header"><span className="learning-time-record-date">{recordDateLabel}</span><span className="learning-time-record-status"><i aria-hidden="true"/>진행중</span></div>
            <div className="learning-time-record-copy"><p><span>총 학습시간</span><strong>{selected.measuredDays === 0 ? '시간 측정 전' : formatTime(selected.seconds)}</strong></p>
              {selected.measuredDays>0 && <small className="learning-time-record-activities">{activities.map(activity=>{
                const shortLabel = {analysis:'문장분석',vocabulary:'단어',quiz:'테스트',story:'스토리텔링'}[activity.key]
                const description = `${activity.label} ${formatTime(selected.byActivity[activity.key])}`
                return <span key={activity.key} title={description} aria-label={description}>{shortLabel} {formatTime(selected.byActivity[activity.key])}</span>
              })}</small>}
            </div>
          </div>}

          <dl className="learning-time-averages"><div><dt>하루 평균</dt><dd>{formatTime(measuredCount ? total / measuredCount : 0)}</dd></div><div><dt>학습한 날 평균</dt><dd>{activeDays ? formatTime(total / activeDays) : '기록 없음'}</dd></div></dl>
          </div>
          {query.isError && <p role="status">최신 기록을 불러오지 못해 마지막으로 확인한 시간을 표시하고 있어요.</p>}
        </>}
  </section>
}

export default function LearningTimeChart() {
  return <AnalyticsPeriod><LearningTimeChartContent/></AnalyticsPeriod>
}
