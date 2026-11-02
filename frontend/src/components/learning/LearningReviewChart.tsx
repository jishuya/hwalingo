import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon, CalendarCheckIcon, CaretRightIcon, PlayIcon } from '@phosphor-icons/react'
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
    <div className="learning-review-heading"><div><span className="learning-review-eyebrow"><CalendarCheckIcon weight="duotone"/> 다음 배움을 준비해요</span><h2 id="learning-review-title">복습 예정</h2><p>오늘부터 7일 · 한국 시간 기준</p></div><button className="learning-review-refresh" type="button" aria-label="복습 예정 새로고침" disabled={query.isFetching} onClick={() => { setNow(new Date()); void query.refetch() }}><ArrowClockwiseIcon/>새로고침</button></div>
    {query.isPending ? <p role="status">복습 일정을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>복습 일정을 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <div className="learning-review-summary"><button type="button" className="learning-review-overdue" onClick={() => setSelected('overdue')} aria-label={`밀린 복습 ${schedule.overdue.length}개, 단어 목록 보기`}><span>밀린 복습 <CaretRightIcon/></span><strong>{number(schedule.overdue.length)}<small>개</small></strong><small>어제까지 예정된 단어</small></button><div><span>앞으로 7일 예정</span><strong>{number(total)}<small>개</small></strong><small>오늘 예정 포함 · 밀린 복습 제외</small></div></div>
          <div className="learning-review-plot"><div className="learning-review-axis" aria-hidden="true"><span>{ceiling}개</span><span>{ceiling / 2}개</span><span>0개</span></div><div className="learning-review-bars" role="group" aria-label="오늘부터 7일간 날짜별 복습 예정 단어 수">{schedule.days.map((day, index) => <button type="button" key={day.date} className={index === 0 ? 'today' : ''} aria-label={`${label(day.date)}, 복습 예정 ${day.words.length}개, 단어 목록 보기`} onClick={() => setSelected(day.date)}><strong>{number(day.words.length)}</strong><span className="learning-review-track"><span style={{ height: `${day.words.length / ceiling * 100}%` }}/></span><span className="learning-review-day">{index === 0 ? '오늘' : index === 1 ? '내일' : label(day.date)}</span></button>)}</div></div>
          <div className="learning-review-action"><div><strong>지금 복습 가능한 단어 {number(schedule.dueNow.length)}개</strong><p>밀린 복습과 오늘 복습 시각이 된 단어예요.</p></div><button type="button" className="primary" onClick={onStart} disabled={!schedule.dueNow.length}><PlayIcon weight="fill"/>오늘의 테스트 시작하기</button></div>
          {!total && !schedule.overdue.length && <p className="learning-review-note">앞으로 7일 안에 예정된 복습이 없어요. 새 단어를 학습하면 복습 일정이 생겨요.</p>}
          <p className="learning-review-note">현재 보관 중이며 첫 답안 기록이 있는 단어만 집계해요. 마스터도 포함하며 학습 결과에 따라 일정이 바뀔 수 있어요. 막대를 누르면 단어 목록을 볼 수 있어요.</p><p className="learning-review-note">오늘의 테스트는 기존 출제 규칙에 따라 새 단어와 복습을 구성해요. 미래 복습 예정 단어를 미리 출제하지 않아요.</p>
          {query.isError && <p className="learning-review-note" role="status">최신 기록을 불러오지 못해 마지막으로 확인한 일정을 표시하고 있어요.</p>}
        </>}
    <Modal open={selected !== null} title={title} description={`현재 기준 ${selectedWords.length}개예요. 복습 예정 시각 순서로 표시해요.`} onClose={() => setSelected(null)} size="large">
      {selectedWords.length ? <ul className="learning-review-words">{selectedWords.map(word => <li key={word.vocabularyId}><strong>{word.word}</strong><p>{word.meaning}</p><small>복습 예정 · {timeLabel(word.progress.nextReviewAt)}{word.progress.masteryLevel >= 6 ? ' · 마스터' : ''}</small></li>)}</ul> : <p className="learning-review-note">해당 날짜에 복습할 단어가 없어요.</p>}
    </Modal>
  </section>
}
