import { useState } from 'react'
import { ClockIcon, ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../services/auth'
import { flushLearningTime, getLearningTime } from '../../services/learningTime'
import './LearningTimeChart.css'

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  if (seconds > 0 && whole === 0) return '1초 미만'
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = whole % 60
  return [hours ? `${hours}시간` : '', minutes ? `${minutes}분` : '', rest ? `${rest}초` : ''].filter(Boolean).join(' ') || '0분'
}
const dateLabel = (date: string) => new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })
const seoulDate = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date))

export default function LearningTimeChart() {
  const auth = useQuery({ queryKey: ['auth', 'me'], queryFn: getCurrentUser })
  const userId = auth.data?.user.id
  const query = useQuery({
    queryKey: ['learning-time', userId],
    queryFn: async () => {
      await flushLearningTime(userId!)
      return getLearningTime()
    },
    enabled: Boolean(userId),
    refetchInterval: 20_000,
  })
  const [selectedDate, setSelectedDate] = useState<string>()
  const data = query.data
  const start = data ? seoulDate(data.measurementStartedAt) : ''
  const days = data?.days ?? []
  const today = days.at(-1)
  const measuredDays = days.filter(day => day.date >= start)
  const total = measuredDays.reduce((sum, day) => sum + day.seconds, 0)
  const activeDays = measuredDays.filter(day => day.seconds > 0)
  const maximum = Math.max(60, ...days.map(day => day.seconds))
  const ceiling = Math.ceil(maximum / 60) * 60
  const selected = days.find(day => day.date === selectedDate) ?? today

  return <section className="card learning-time-card" aria-labelledby="learning-time-title">
    <div className="learning-time-heading">
      <div><span className="learning-time-eyebrow"><ClockIcon weight="duotone"/> 나의 학습 습관</span><h2 id="learning-time-title">학습 시간</h2><p>최근 7일 · 한국 시간 기준</p></div>
      <button type="button" className="learning-time-refresh" onClick={() => void query.refetch()} disabled={query.isFetching || !userId} aria-label="학습 시간 새로고침"><ArrowClockwiseIcon/>새로고침</button>
    </div>
    {query.isPending ? <p role="status">학습 시간을 불러오는 중이에요.</p>
      : query.isError && !data ? <div role="alert"><p>학습 시간을 불러오지 못했어요.</p><button type="button" className="primary" onClick={() => void query.refetch()}>다시 시도</button></div>
        : data && <>
          <div className="learning-time-totals">
            <div><span>오늘 학습</span><strong>{formatTime(today?.seconds ?? 0)}</strong></div>
            <div><span>최근 7일 합계</span><strong>{formatTime(total)}</strong></div>
          </div>
          <div className="learning-time-plot">
            <div className="learning-time-axis" aria-hidden="true"><span>{Math.round(ceiling / 60)}분</span><span>{Number((ceiling / 120).toFixed(1))}분</span><span>0분</span></div>
            <div className="learning-time-bars" role="group" aria-label="최근 7일 날짜별 학습 시간">
              {days.map(day => {
                const before = day.date < start
                const label = day.date === today?.date ? '오늘' : dateLabel(day.date)
                return <button key={day.date} type="button" className={`${before ? 'before-measurement' : ''} ${selected?.date === day.date ? 'selected' : ''}`} onClick={() => setSelectedDate(day.date)} aria-pressed={selected?.date === day.date} aria-label={`${dateLabel(day.date)}, ${before ? '측정 전' : formatTime(day.seconds)}`}>
                  <span className="learning-time-bar-track"><span className="learning-time-bar" style={{ height: `${before ? 0 : day.seconds / ceiling * 100}%` }}/>{(before || day.seconds === 0) && <span className="learning-time-zero">{before ? '–' : '0'}</span>}</span>
                  <span className="learning-time-day">{label}</span>
                </button>
              })}
            </div>
          </div>
          {selected && <p className="learning-time-selection" aria-live="polite">{dateLabel(selected.date)} <strong>{selected.date < start ? '시간 측정 전' : formatTime(selected.seconds)}</strong></p>}
          {total === 0 && <p className="learning-time-empty">문장을 읽거나 단어를 복습하면 학습 시간이 쌓여요.</p>}
          <dl className="learning-time-averages"><div><dt>하루 평균</dt><dd>{formatTime(measuredDays.length ? total / measuredDays.length : 0)}</dd></div><div><dt>학습한 날 평균</dt><dd>{activeDays.length ? formatTime(total / activeDays.length) : '기록 없음'}</dd></div></dl>
          <p className="learning-time-note">{dateLabel(start)}부터 측정한 기록이에요. 하루 평균은 측정 시작일부터 오늘까지, 최근 7일 안의 날짜로 계산해요. 화면 이탈과 장시간 무활동은 제외해요.</p>
          {query.isError && <p role="status" className="learning-time-note">최신 기록을 불러오지 못해 마지막으로 확인한 시간을 표시하고 있어요.</p>}
        </>}
  </section>
}
