import { useAnalyticsPeriod } from './analyticsContext'
import { formatAnalyticsDate } from '../../services/analytics'
import { useState } from 'react'
import { ArrowClockwiseIcon, TargetIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { getLearningVolume } from '../../services/progress'
import './LearningAccuracyChart.css'


export default function LearningAccuracyChart() {
  const { selection, label: periodLabel } = useAnalyticsPeriod()
  // Share the same request/cache as the volume chart so both cards use identical counts.
  const query = useQuery({ queryKey: ['progress', 'activity', selection], queryFn: () => getLearningVolume(selection), refetchInterval: 20_000 })
  const dateLabel = (date: string) => formatAnalyticsDate(date,query.data?.range?.grain)
  const [selectedDate, setSelectedDate] = useState<string>()
  const days = query.data?.days.map(day => {
    const total = day.newAnswers + day.reviewAnswers
    return { ...day, total, accuracy: total ? day.correctAnswers / total * 100 : null }
  }) ?? []
  const selected = days.find(day => day.date === selectedDate) ?? days.at(-1)
  const total = days.reduce((sum, day) => sum + day.total, 0)
  const correct = days.reduce((sum, day) => sum + day.correctAnswers, 0)
  // Separate paths across missing days. A real 0% remains a point on the baseline.
  const paths: string[] = []
  let path = ''
  const x = (index: number) => (index + 0.5) / Math.max(1, days.length) * 700
  const y = (accuracy: number) => 10 + (100 - accuracy) * 1.5
  days.forEach((day, index) => {
    if (day.accuracy === null) {
      if (path) paths.push(path)
      path = ''
    } else path += `${path ? ' L' : 'M'} ${x(index)} ${y(day.accuracy)}`
  })
  if (path) paths.push(path)

  return <section className="card learning-accuracy-card" aria-labelledby="learning-accuracy-title">
    <div className="learning-accuracy-heading"><div><span className="learning-accuracy-eyebrow"><TargetIcon weight="duotone"/> 기억을 확인하는 시간</span><h2 id="learning-accuracy-title">첫 시도 정답률</h2><p>{periodLabel} · 한국 시간 기준</p></div><button type="button" className="learning-accuracy-refresh" aria-label="첫 시도 정답률 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowClockwiseIcon/>새로고침</button></div>
    {query.isPending ? <p role="status">정답률을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>정답률을 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <div className="learning-accuracy-summary"><div><span>선택 기간 정답률</span><strong>{total ? `${Math.round(correct / total * 100)}%` : '기록 없음'}</strong></div><p>첫 시도 {total.toLocaleString('ko-KR')}문제 중 <b>{correct.toLocaleString('ko-KR')}문제 정답</b></p></div>
          <div className="analytics-chart-scroll"><div className="learning-accuracy-chart" style={{minWidth: days.length > 14 ? days.length*48+44 : undefined}}><div className="learning-accuracy-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div><div className="learning-accuracy-columns" style={{gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`}} role="group" aria-label="선택 기간 구간별 첫 시도 정답률">
            <svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="report-accuracy-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".22"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
              {paths.map((segment,index) => { const coordinates = segment.match(/[\d.]+/g)?.map(Number) ?? []; return coordinates.length >= 4 ? <path key={index} d={`${segment} L ${coordinates.at(-2)} 160 L ${coordinates[0]} 160 Z`} fill="url(#report-accuracy-fill)"/> : null })}
              {[10, 85, 160].map(value => <line key={value} x1="0" x2="700" y1={value} y2={value} className="accuracy-grid"/>)}
              {paths.map((segment, index) => <path key={index} d={segment} className="accuracy-line"/>)}
            </svg>
            {days.map(day => <button key={day.date} type="button" className={selected?.date === day.date ? 'selected' : ''} aria-pressed={selected?.date === day.date} aria-label={`${dateLabel(day.date)}, ${day.accuracy === null ? '응시 기록 없음' : `정답률 ${Math.round(day.accuracy)}%, ${day.total}문제 중 ${day.correctAnswers}문제 정답`}`} onClick={() => setSelectedDate(day.date)}>{day.accuracy !== null && <span aria-hidden="true" className="accuracy-marker" style={{ top: `${y(day.accuracy)}px` }}/>}<span className="accuracy-hit-area"/><span className="accuracy-date">{day.date === query.data?.range?.today && query.data?.range?.grain === 'day' ? '오늘' : dateLabel(day.date)}</span><strong>{day.accuracy === null ? '–' : `${Math.round(day.accuracy)}%`}</strong><small>{day.total ? `${day.total}문제` : '기록 없음'}</small></button>)}
          </div></div>
          </div>
          {selected && <div className="learning-accuracy-detail" aria-live="polite"><span>{dateLabel(selected.date)}</span><strong>{selected.accuracy === null ? '응시 기록 없음' : `${Math.round(selected.accuracy)}%`}</strong><span>{selected.total ? `${selected.total}문제 중 ${selected.correctAnswers}문제 정답 · ${selected.total - selected.correctAnswers}문제 오답` : '테스트를 풀면 정답률이 표시돼요.'}</span></div>}
          {!total && <p className="learning-accuracy-note">아직 선택 기간의 응시 기록이 없어요. 첫 테스트부터 차곡차곡 기록해드릴게요.</p>}
          <p className="learning-accuracy-note">오답 재도전은 제외해요. 기간 정답률은 전체 첫 시도 답안으로 계산하며, 응시하지 않은 날은 선을 연결하지 않아요. 스와이프 테스트는 직접 선택한 정오답 기준이에요.</p>
          {query.isError && <p role="status" className="learning-accuracy-note">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
  </section>
}
