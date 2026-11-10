import ChartStaleNotice from './ChartStaleNotice'
import './LearningWeakWordsChart.css'
import ChartErrorState from './ChartErrorState'
import ReportSummary from './ReportSummary'
import GrowthChart from './GrowthChart'
import AnalyticsPeriod, { AnalyticsPeriodControls } from './AnalyticsPeriod'
import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, CalendarDotsIcon, GlobeIcon, TrendUpIcon } from '@phosphor-icons/react'
import { getLearningInsights, formatAnalyticsDate, type LearningInsights } from '../../services/analytics'
import { useAnalyticsPeriod } from './analyticsContext'
import { languageOptions } from '../../services/analysis'
import { getVocabularies } from '../../services/vocabulary'
import { Modal } from '../ui/Dialog'

function InsightCard({title,description,children,periodControls=false}: {title:string;description:string;periodControls?:boolean;children:(data:LearningInsights)=>ReactNode}) {
  const {selection} = useAnalyticsPeriod()
  const query = useQuery({queryKey:['progress','insights',selection],queryFn:()=>getLearningInsights(selection),refetchInterval:20_000})
  const errorMessage = title==='요일별 학습 패턴'?'요일별 학습 기록을 불러오지 못했어요.':title==='언어별 학습 현황'?'언어별 학습 현황을 불러오지 못했어요.':'XP 획득 기록을 불러오지 못했어요.'
  const TitleIcon = title==='요일별 학습 패턴'?CalendarDotsIcon:title==='언어별 학습 현황'?GlobeIcon:TrendUpIcon
  return <section className="card analytics-card"><div className="analytics-card-head report-chart-heading"><div><h2><TitleIcon weight="duotone" aria-hidden="true"/>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="report-chart-refresh" title="새로고침" disabled={query.isFetching} onClick={()=>void query.refetch()} aria-label={`${title} 새로고침`}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>{periodControls&&<AnalyticsPeriodControls/>}{query.isPending ? <p role="status">통계를 불러오는 중이에요.</p> : query.isError && !query.data ? <ChartErrorState message={errorMessage} retrying={query.isFetching} onRetry={()=>void query.refetch()}/> : query.data && children(query.data)}{query.isError && query.data && <ChartStaleNotice/>}</section>
}
const weekdays = ['월','화','수','목','금','토','일']
const number = (n:number) => n.toLocaleString('ko-KR',{maximumFractionDigits:1})
const languageName = (code:string) => languageOptions.find(language=>language.code===code)?.label ?? code

function Weekdays() {
  const [metric,setMetric] = useState<'answers'|'time'>('answers')
  const [selected,setSelected] = useState(0)
  return <InsightCard title="요일별 학습 패턴" description="">{data=>{
    const value = (day:LearningInsights['weekdays'][number]) => metric==='answers' ? day.averageAnswers : day.averageSeconds===null ? null : day.averageSeconds/60
    const max = Math.max(1,...data.weekdays.map(day=>value(day)??0))
    const selectedDay = data.weekdays[selected]
    const end = new Date(`${data.range.today}T00:00:00+09:00`)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate()-55)
    const rangeDate = (date:Date) => date.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'})
    return <><div className="analytics-switch analytics-weekday-period" role="group" aria-label="요일 패턴 지표"><button type="button" aria-pressed={metric==='answers'} onClick={()=>setMetric('answers')}>풀이 수</button><button type="button" aria-pressed={metric==='time'} onClick={()=>setMetric('time')}>학습 시간</button></div><p className="analytics-weekday-range">{rangeDate(start)} ~ {rangeDate(end)}</p><div className={`analytics-horizontal analytics-weekday-chart metric-${metric}`} role="group" aria-label="요일별 평균 학습 그래프">{data.weekdays.map((day,index)=><button type="button" key={day.weekday} aria-pressed={selected===index} onClick={()=>setSelected(index)} aria-label={`${weekdays[index]}요일 평균 ${value(day)===null?'측정 전':`${number(value(day)!)}${metric==='answers'?'문제':'분'}`}`}><span className={`weekday-badge${index>=5?' weekend':''}`}>{weekdays[index]}</span><span className="analytics-track"><i style={{width:`${(value(day)??0)/max*100}%`}}/></span><strong>{value(day)===null?'측정 전':<>{number(value(day)!)}<small>{metric==='answers'?'문제':'분'}</small></>}</strong></button>)}</div>{selectedDay && <div className="analytics-detail learning-time-details" aria-live="polite">
      <div className="learning-time-record"><div className="learning-time-record-header"><span className="learning-time-record-date">{weekdays[selected]}요일</span><span className="analytics-detail-caption">최근 8주</span></div>
        <div className="learning-time-record-copy"><p><span>{metric==='answers'?'평균 풀이 수':'평균 학습 시간'}</span><strong>{value(selectedDay)===null?'측정 전':`${number(value(selectedDay)!)}${metric==='answers'?'문제':'분'}`}</strong></p></div>
      </div>
      <dl className="learning-time-averages"><div><dt>학습한 날</dt><dd>{selectedDay.activeDays} / {selectedDay.observedDays}일</dd></div><div><dt>{metric==='answers'?'최고 풀이 수':'최장 학습 시간'}</dt><dd>{metric==='answers'?(selectedDay.maxAnswers==null?'기록 없음':`${number(selectedDay.maxAnswers)}문제`):selectedDay.maxSeconds==null?'측정 전':`${number(selectedDay.maxSeconds/60)}분`}</dd></div></dl>
    </div>}</>
  }}</InsightCard>
}
function Languages() {
  const [metric,setMetric] = useState<'saved'|'learned'|'mastered'|'answers'>('saved')
  const [selected,setSelected] = useState<string|null>(null)
  const words = useQuery({queryKey:['vocabularies'],queryFn:()=>getVocabularies(),enabled:selected!==null})
  const metricLabel = {saved:'저장',learned:'학습',mastered:'마스터',answers:'풀이'}
  const filtered = (words.data??[]).filter(word=>word.languageCode===selected && (metric==='mastered'?word.progress.masteryLevel>=6:metric==='learned'?word.progress.totalAttempts>0:true))
  return <><InsightCard title="언어별 학습 현황" description="">{data=>{
    const max = Math.max(1,...data.languages.map(item=>item[metric]))
    return <><div className="analytics-switch report-metric-switch" role="group" aria-label="언어별 학습 지표">{(['saved','learned','mastered','answers'] as const).map(item=><button type="button" key={item} aria-pressed={item===metric} onClick={()=>setMetric(item)}>{metricLabel[item]}</button>)}</div>{metric==='answers'&&<AnalyticsPeriodControls/>}{data.languages.length>0?<div className="analytics-horizontal languages">{data.languages.map(item=><button type="button" key={item.language} onClick={()=>setSelected(item.language)} aria-label={`${languageName(item.language)} ${metricLabel[metric]} ${item[metric]}${metric==='answers'?'문제':'개'}, 보관 단어 목록 보기`}><span><span className="analytics-language-flag" aria-hidden="true">{({en:'🇬🇧',zh:'🇨🇳',fr:'🇫🇷',de:'🇩🇪',es:'🇪🇸',ja:'🇯🇵',ko:'🇰🇷'} as Record<string,string>)[item.language]}</span>{languageName(item.language)}</span><span className="analytics-track"><i style={{width:`${item[metric]/max*100}%`}}/></span><strong>{number(item[metric])}{metric==='answers'?'문제':'개'}</strong></button>)}</div>:<div className="learning-weak-empty learning-language-empty"><GlobeIcon weight="duotone" aria-hidden="true"/><h3>아직 언어별 학습 기록이 없어요</h3><p>단어를 저장하고 학습하면<br/>언어별 현황을 보여드릴게요.</p></div>}</>
  }}</InsightCard><Modal open={selected!==null} title={`${selected?languageName(selected):''} 보관 단어`} description={metric==='answers'?'현재 보관 중인 단어 목록이에요. 기간별 풀이 수와 다를 수 있어요.':`${metricLabel[metric]} 단어 목록이에요.`} onClose={()=>setSelected(null)} size="large">{words.isPending?<p role="status">단어를 불러오는 중이에요.</p>:words.isError?<div role="alert"><p>단어를 불러오지 못했어요.</p><button type="button" className="primary" onClick={()=>void words.refetch()}>다시 시도</button></div>:<><p>총 {filtered.length}개</p><ul className="analytics-word-list">{filtered.map(word=><li key={word.vocabularyId}><strong>{word.word}</strong><p>{word.meaning}</p></li>)}</ul>{!filtered.length&&<p>해당하는 보관 단어가 없어요.</p>}</>}</Modal></>
}
function Growth() {
  const [selected,setSelected] = useState<string>()
  return <InsightCard periodControls title="기간별 XP 획득" description="">{data=>{
    const points = data.growth.days
    const active = points.find(point=>point.date===selected)??points.at(-1)!
    const earned = data.growth.days.reduce((sum,day)=>sum+day.earnedXp,0)
    return <><ReportSummary className="analytics-growth-summary" items={[{label:'기간 획득 XP',value:`+${number(earned)}`,unit:'XP'},{label:'최다 획득 XP',value:`+${number(Math.max(0,...points.map(point=>point.earnedXp)))}`,unit:'XP',tone:'amber'}]}/><GrowthChart key={`${data.range.start}-${data.range.end}-${data.range.grain}`} points={points} grain={data.range.grain} selected={active.date} onSelect={setSelected}/><div className="analytics-detail learning-time-details" aria-live="polite">
      <div className="learning-time-record"><div className="learning-time-record-header"><span className="learning-time-record-date">{active.date==='opening'?'기간 시작 전':formatAnalyticsDate(active.date,data.range.grain)}</span>{active.levelsGained>0&&<span className="learning-time-record-status">+{active.levelsGained}레벨</span>}</div>
        <div className="learning-time-record-copy"><p><span>획득 XP</span><strong>+{number(active.earnedXp)} XP</strong></p></div>
      </div>
      {active.date!=='opening'&&<><dl className="learning-time-averages"><div><dt>누적 XP</dt><dd>{number(active.totalXp)} XP</dd></div><div><dt>레벨</dt><dd>Lv.{active.level}</dd></div></dl><p className="analytics-detail-grade">{active.grade}</p></>}
    </div></>
  }}</InsightCard>
}
export default function LearningInsightsCharts({kind}:{kind:'weekdays'|'languages'|'growth'}) {
  return kind==='weekdays'?<Weekdays/>:kind==='languages'?<AnalyticsPeriod key="languages"><Languages/></AnalyticsPeriod>:<AnalyticsPeriod key="growth"><Growth/></AnalyticsPeriod>
}
