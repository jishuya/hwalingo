import { useEffect, useState, type ReactNode } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { AnalyticsContext } from './analyticsContext'
import type { AnalyticsSelection } from '../../services/analytics'

export default function AnalyticsPeriod({ children }: { children: ReactNode }) {
  const [period,setPeriod] = useState<'week'|'month'|'year'|'all'>('week')
  const [offset,setOffset] = useState(0)
  const [now,setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()),60_000); return () => window.clearInterval(timer) },[])
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  const start = new Date(`${today}T00:00:00Z`)
  const end = new Date(start)
  if (period === 'week') { start.setUTCDate(start.getUTCDate()-6+offset*7); end.setUTCDate(end.getUTCDate()+offset*7) }
  if (period === 'month') { start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth()+offset); end.setTime(start.getTime()); end.setUTCMonth(end.getUTCMonth()+1); end.setUTCDate(0) }
  if (period === 'year') { start.setUTCMonth(0,1); start.setUTCFullYear(start.getUTCFullYear()+offset); end.setTime(start.getTime()); end.setUTCMonth(11,31) }
  const from = start.toISOString().slice(0,10)
  const to = [end.toISOString().slice(0,10),today].sort()[0]
  const selection: AnalyticsSelection = period === 'all' ? {period:'all'} : {from,to}
  const label = period === 'all' ? '전체 기간' : `${from} ~ ${to}`
  return <AnalyticsContext.Provider value={{selection,label}}>
    <section className="analytics-period card" aria-label="통계 조회 기간"><div role="group" aria-label="기간 선택">{(['week','month','year','all'] as const).map((value,index) => <button key={value} type="button" aria-pressed={period===value} onClick={() => {setPeriod(value);setOffset(0)}}>{['주','월','년','전체'][index]}</button>)}</div><div className="analytics-period-dates">{period !== 'all' && <button type="button" aria-label="이전 기간" disabled={from<'1971-01-01'} onClick={() => setOffset(offset-1)}><CaretLeftIcon/></button>}<span aria-live="polite">{label}</span>{period !== 'all' && <button type="button" aria-label="다음 기간" disabled={offset>=0} onClick={() => setOffset(offset+1)}><CaretRightIcon/></button>}</div><p>기간별 통계에 적용해요. 잔디·요일 패턴·현재 어휘 상태·복습 일정은 각 카드의 기준을 따라요.</p></section>
    {children}
  </AnalyticsContext.Provider>
}
