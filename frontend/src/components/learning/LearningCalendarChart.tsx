import ChartErrorState from './ChartErrorState'
import { useState, type CSSProperties } from 'react'
import { CalendarDotsIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { getLearningCalendar, getUserProgress } from '../../services/progress'
import './LearningCalendarChart.css'

const weekday = ['월', '화', '수', '목', '금', '토', '일']
const mondayOffset = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
const dateLabel = (date: string) => new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
function intensity(count: number) { return count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : count < 30 ? 3 : 4 }

export default function LearningCalendarChart() {
  const query = useQuery({ queryKey: ['progress', 'calendar'], queryFn: getLearningCalendar, refetchInterval: 20_000 })
  const progress = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress })
  const [period, setPeriod] = useState<'recent' | 'year'>('recent')
  const [selectedDate, setSelectedDate] = useState<string>()
  const all = query.data?.days ?? []
  const today = all.at(-1)
  const recentLength = today ? 78 + mondayOffset(today.date) : 0
  const days = period === 'year' ? all : all.slice(-recentLength)
  const selected = days.find(day => day.date === selectedDate) ?? days.at(-1)
  const leading = days[0] ? mondayOffset(days[0].date) : 0
  const columns = Math.ceil((leading + days.length) / 7)
  const cells = Array.from({ length: columns * 7 }, (_, index) => days[index - leading])
  const activeDays = days.filter(day => day.activityCount > 0).length

  return <section className="card learning-calendar-card" aria-labelledby="learning-calendar-title">
    <div className="learning-calendar-heading report-chart-heading"><div><h2 id="learning-calendar-title"><CalendarDotsIcon weight="duotone" aria-hidden="true"/> 학습 잔디</h2></div><button className="learning-calendar-refresh report-chart-refresh" type="button" aria-label="학습 잔디 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>
    <div className="learning-calendar-period" role="group" aria-label="학습 잔디 기간"><button type="button" aria-pressed={period === 'recent'} onClick={() => setPeriod('recent')}>최근 12주</button><button type="button" aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>최근 1년</button></div>
    {query.isPending ? <p role="status">학습 잔디를 불러오는 중이에요.</p>
      : query.isError && !query.data ? <ChartErrorState message="학습 잔디를 불러오지 못했어요." retrying={query.isFetching} onRetry={() => void query.refetch()}/>
        : query.data && <>
          {days[0] && today && <p className="learning-calendar-range" aria-live="polite">{dateLabel(days[0].date)} ~ {dateLabel(today.date)}</p>}
          <div className="learning-calendar-summary"><div><span title="선택한 기간 내 학습한 날짜 수">학습일수</span><strong>{activeDays.toLocaleString('ko-KR')}<small>일</small></strong></div><div><span>현재 연속</span><strong>{progress.data ? progress.data.currentStreak.toLocaleString('ko-KR') : '–'}<small>일</small></strong></div><div><span title="전체 기간 최장 연속 학습">최장 연속</span><strong>{progress.data ? progress.data.longestStreak.toLocaleString('ko-KR') : '–'}<small>일</small></strong></div></div>
          <div className={`learning-calendar-scroll ${period === 'year' ? 'year' : ''}`} tabIndex={period === 'year' ? 0 : undefined} role="region" aria-label={period === 'year' ? '최근 1년 학습 잔디, 가로로 스크롤해 확인하세요' : '최근 12주 학습 잔디'}>
            <div className="learning-calendar-layout" style={{ '--calendar-columns': columns } as CSSProperties}>
              <div className="learning-calendar-months" aria-hidden="true">{Array.from({ length: columns }, (_, column) => {
                const week = cells.slice(column * 7, column * 7 + 7).filter(Boolean)
                const first = week[0]
                const previous = cells.slice(Math.max(0, (column - 1) * 7), column * 7).filter(Boolean).at(-1)
                const monthStart = week.find(day => day.date.endsWith('-01'))
                const month = monthStart ?? (!previous ? first : undefined)
                return <span key={column}>{month ? `${Number(month.date.slice(5, 7))}월` : ''}</span>
              })}</div>
              <div className="learning-calendar-weekdays" aria-hidden="true">{weekday.map(label => <span key={label}>{label}</span>)}</div>
              <div className="learning-calendar-grid" role="group" aria-label="날짜별 학습 활동, 월요일부터 일요일 순서">{cells.map((day, index) => day ? <button key={day.date} type="button" className={`level-${intensity(day.activityCount)} ${selected?.date === day.date ? 'selected' : ''}`} aria-pressed={selected?.date === day.date} aria-label={`${dateLabel(day.date)}, ${day.activityCount ? `학습 활동 ${day.activityCount}회` : '학습 기록 없음'}${day.date === today?.date ? ', 오늘' : ''}`} title={`${dateLabel(day.date)} · ${day.activityCount}회`} onClick={() => setSelectedDate(day.date)}/> : <span key={`empty-${index}`} aria-hidden="true"/>)}</div>
            </div>
          </div>
          <div className="learning-calendar-legend" aria-label="활동 수에 따른 색상: 없음, 1~4회, 5~14회, 15~29회, 30회 이상"><span>적게</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`level-${level}`} aria-hidden="true"/>)}<span>많이</span></div>
          {selected && <div className="learning-calendar-detail learning-time-details" aria-live="polite">
            <div className="learning-time-record">
              <div className="learning-time-record-header"><span className="learning-time-record-date">{dateLabel(selected.date)}</span>{selected.date===today?.date&&<span className="learning-time-record-status"><i aria-hidden="true"/>오늘</span>}</div>
              <div className="learning-time-record-copy"><p><span>학습 활동</span><strong>{selected.activityCount.toLocaleString('ko-KR')}회</strong></p></div>
            </div>
            <dl className="learning-time-averages"><div><dt>첫 답안 풀이</dt><dd>{selected.answerCount.toLocaleString('ko-KR')}문제</dd></div><div><dt>획득 경험치</dt><dd>{selected.earnedXp.toLocaleString('ko-KR')} XP</dd></div></dl>
            {!selected.activityCount&&<p className="calendar-detail-empty">이 날짜에는 기록된 학습 활동이 없어요.</p>}
          </div>}
          {query.isError && <p role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
  </section>
}
