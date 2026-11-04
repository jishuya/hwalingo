import ReportSummary from './ReportSummary'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, CalendarCheckIcon, PlayIcon } from '@phosphor-icons/react'
import { getVocabularies } from '../../services/vocabulary'
import { buildReviewSchedule } from '../../domain/reviewSchedule'
import { Modal } from '../ui/Dialog'
import './LearningReviewChart.css'

const label = (date: string) => new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })
const timeLabel = (date: string) => new Date(date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const number = (value: number) => value.toLocaleString('ko-KR')

export default function LearningReviewChart({ onStart }: { onStart: () => void }) {
  const query = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies(), refetchInterval: 20_000 })
  const [now, setNow] = useState(() => new Date())
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 20_000)
    return () => window.clearInterval(interval)
  }, [])
  const schedule = buildReviewSchedule(query.data ?? [], now)
  const total = schedule.days.reduce((sum, day) => sum + day.words.length, 0)
  const maximum = Math.max(5, ...schedule.days.map(day => day.words.length))
  const ceiling = Math.ceil(maximum / 10) * 10
  const selectedWords = selected === 'overdue' ? schedule.overdue : schedule.days.find(day => day.date === selected)?.words ?? []
  const title = selected === 'overdue' ? '밀린 복습' : selected ? `${label(selected)} 복습 예정` : '복습 예정'

  return <section className="card learning-review-card" aria-labelledby="learning-review-title">
    <div className="learning-review-heading report-chart-heading"><div><h2 id="learning-review-title"><CalendarCheckIcon weight="duotone" aria-hidden="true"/> 복습 예정</h2></div><button className="learning-review-refresh report-chart-refresh" type="button" aria-label="복습 예정 새로고침" disabled={query.isFetching} onClick={() => { setNow(new Date()); void query.refetch() }}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>
    {schedule.days[0]&&<p className="report-fixed-range">{label(schedule.days[0].date)} ~ {label(schedule.days.at(-1)!.date)}</p>}
    {query.isPending ? <p role="status">복습 일정을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>복습 일정을 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <ReportSummary className="learning-review-summary" items={[
            {label:'밀린 복습',value:number(schedule.overdue.length),unit:'개',tone:'amber',onClick:()=>setSelected('overdue')},
            {label:'7일 복습 예정',value:number(total),unit:'개'},
          ]}/>

          <div className="learning-review-plot"><div className="learning-review-axis" aria-hidden="true"><span>{ceiling}개</span><span>{ceiling / 2}개</span><span>0개</span></div><div className="learning-review-bars" role="group" aria-label="오늘부터 7일간 날짜별 복습 예정 단어 수">{schedule.days.map((day, index) => <button type="button" key={day.date} className={`${index===0?'today':''} ${selected===day.date?'selected':''}`} aria-pressed={selected===day.date} aria-label={`${label(day.date)}, 복습 예정 ${day.words.length}개, 단어 목록 보기`} onClick={() => setSelected(day.date)}><strong>{number(day.words.length)}</strong><span className="learning-review-track"><span style={{ height: `${day.words.length / ceiling * 100}%` }}/></span><span className="learning-review-day">{index === 0 ? '오늘' : index === 1 ? '내일' : label(day.date)}</span></button>)}</div></div>
          <div className="learning-review-action"><div><strong>지금 복습 가능한 단어 {number(schedule.dueNow.length)}개</strong></div><button type="button" className="primary" onClick={onStart} disabled={!schedule.dueNow.length}><PlayIcon weight="fill"/>오늘의 테스트 시작하기</button></div>

          {query.isError && <p role="status">최신 기록을 불러오지 못해 마지막으로 확인한 일정을 표시하고 있어요.</p>}
        </>}
    <Modal open={selected !== null} title={title} description={`현재 기준 ${selectedWords.length}개예요. 복습 예정 시각 순서로 표시해요.`} onClose={() => setSelected(null)} size="large">
      {selectedWords.length ? <ul className="learning-review-words">{selectedWords.map(word => <li key={word.vocabularyId}><strong>{word.word}</strong><p>{word.meaning}</p><small>복습 예정 · {timeLabel(word.progress.nextReviewAt)}{word.progress.masteryLevel >= 6 ? ' · 마스터' : ''}</small></li>)}</ul> : <p>해당 날짜에 복습할 단어가 없어요.</p>}
    </Modal>
  </section>
}
