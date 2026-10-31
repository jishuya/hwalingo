import { useAnalyticsPeriod } from './analyticsContext'
import { formatAnalyticsDate } from '../../services/analytics'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpenIcon, ArrowClockwiseIcon } from '@phosphor-icons/react'
import { getLearningVolume } from '../../services/progress'
import './LearningVolumeChart.css'

const number = (value: number) => value.toLocaleString('ko-KR')
export default function LearningVolumeChart() {
  const { selection, label: periodLabel } = useAnalyticsPeriod()
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
    <div className="learning-volume-heading"><div><span className="learning-volume-eyebrow"><BookOpenIcon weight="duotone"/> 매일 쌓이는 배움</span><h2 id="learning-volume-title">학습량</h2><p>{periodLabel} · 한국 시간 기준</p></div><button className="learning-volume-refresh" type="button" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="학습량 새로고침"><ArrowClockwiseIcon/>새로고침</button></div>
    {query.isPending ? <p role="status">학습량을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>학습량을 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <div className="learning-volume-summary"><div><span>선택 기간 푼 문제</span><strong>{number(newTotal + reviewTotal)}<small>문제</small></strong></div><div><span>학습한 단어 · 중복 제외</span><strong>{number(query.data.uniqueWords)}<small>개</small></strong></div></div>
          <div className="learning-volume-legend"><span><i className="new"/>새 단어 {number(newTotal)}문제</span><span><i className="review"/>복습 {number(reviewTotal)}문제</span></div>
          <div className="analytics-chart-scroll"><div className="learning-volume-plot" style={{minWidth: days.length > 14 ? days.length*44+38 : undefined}}><div className="learning-volume-axis" aria-hidden="true"><span>{number(ceiling)}</span><span>{number(ceiling / 2)}</span><span>0</span></div><div className="learning-volume-bars" style={{gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`}} role="group" aria-label="선택 기간 새 단어와 복습 문제 수, 단위 문제">
            {days.map(day => <button key={day.date} type="button" className={selected?.date === day.date ? 'selected' : ''} aria-pressed={selected?.date === day.date} aria-label={`${dateLabel(day.date)}, 새 단어 ${day.newAnswers}문제, 복습 ${day.reviewAnswers}문제`} onClick={() => setSelectedDate(day.date)}><span className="learning-volume-track"><span className="learning-volume-stack" style={{ height: `${(day.newAnswers + day.reviewAnswers) / ceiling * 100}%` }}><span className="new" style={{ flex: day.newAnswers }}/><span className="review" style={{ flex: day.reviewAnswers }}/></span>{day.newAnswers + day.reviewAnswers === 0 && <span className="learning-volume-zero">0</span>}</span><span className="learning-volume-day">{day.date === query.data?.range?.today && query.data?.range?.grain === 'day' ? '오늘' : dateLabel(day.date)}</span></button>)}
          </div></div>
          </div>
          {selected && <div className="learning-volume-detail" aria-live="polite"><h3>{dateLabel(selected.date)} 학습 기록</h3><dl><div><dt>푼 문제</dt><dd>{number(selectedTotal)}문제</dd></div><div><dt>새 단어 / 복습</dt><dd>{number(selected.newAnswers)} / {number(selected.reviewAnswers)}문제</dd></div><div><dt>학습한 단어</dt><dd>{number(selected.uniqueWords)}개</dd></div><div><dt>첫 시도 정답률</dt><dd>{selectedTotal ? `${Math.round(selected.correctAnswers / selectedTotal * 100)}% (${selected.correctAnswers}/${selectedTotal})` : '기록 없음'}</dd></div></dl></div>}
          {newTotal + reviewTotal === 0 && <p className="learning-volume-note">테스트를 풀면 새 단어와 복습 기록이 이곳에 쌓여요.</p>}
          <p className="learning-volume-note">새 단어는 보존된 답안 이력에서 처음 답한 단어예요. 이후 답안은 복습으로 집계하며 예정일 전 연습도 포함해요. 오답 재도전은 문제 수와 정답률에서 제외해요.</p>
          {query.isError && <p className="learning-volume-note" role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
  </section>
}
