import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { getLearningInsights, formatAnalyticsDate, type LearningInsights } from '../../services/analytics'
import { useAnalyticsPeriod } from './analyticsContext'
import { languageOptions } from '../../services/analysis'
import { getVocabularies } from '../../services/vocabulary'
import { Modal } from '../ui/Dialog'

function InsightCard({title,description,children}: {title:string;description:string;children:(data:LearningInsights)=>ReactNode}) {
  const {selection} = useAnalyticsPeriod()
  const query = useQuery({queryKey:['progress','insights',selection],queryFn:()=>getLearningInsights(selection),refetchInterval:20_000})
  return <section className="card analytics-card"><div className="analytics-card-head"><div><h2>{title}</h2><p>{description}</p></div><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()} aria-label={`${title} 새로고침`}><ArrowClockwiseIcon/>새로고침</button></div>{query.isPending ? <p role="status">통계를 불러오는 중이에요.</p> : query.isError && !query.data ? <div role="alert"><p>통계를 불러오지 못했어요.</p><button type="button" className="primary" onClick={()=>void query.refetch()}>다시 시도</button></div> : query.data && children(query.data)}{query.isError && query.data && <p role="status" className="analytics-note">최신 기록을 불러오지 못해 마지막 기록을 표시하고 있어요.</p>}</section>
}
const weekdays = ['월','화','수','목','금','토','일']
const number = (n:number) => n.toLocaleString('ko-KR',{maximumFractionDigits:1})
const languageName = (code:string) => languageOptions.find(language=>language.code===code)?.label ?? code

function Weekdays() {
  const [metric,setMetric] = useState<'answers'|'time'>('answers')
  const [selected,setSelected] = useState(0)
  return <InsightCard title="요일별 학습 패턴" description="최근 8주(56일) · 요일별 평균">{data=>{
    const value = (day:LearningInsights['weekdays'][number]) => metric==='answers' ? day.averageAnswers : day.averageSeconds===null ? null : day.averageSeconds/60
    const max = Math.max(1,...data.weekdays.map(day=>value(day)??0))
    const selectedDay = data.weekdays[selected]
    return <><div className="analytics-switch" role="group" aria-label="요일 패턴 지표"><button type="button" aria-pressed={metric==='answers'} onClick={()=>setMetric('answers')}>풀이 수</button><button type="button" aria-pressed={metric==='time'} onClick={()=>setMetric('time')}>학습 시간</button></div><div className="analytics-horizontal">{data.weekdays.map((day,index)=><button type="button" key={day.weekday} aria-pressed={selected===index} onClick={()=>setSelected(index)} aria-label={`${weekdays[index]}요일 평균 ${value(day)===null?'측정 전':`${number(value(day)!)}${metric==='answers'?'문제':'분'}`}`}><span>{weekdays[index]}</span><span className="analytics-track"><i style={{width:`${(value(day)??0)/max*100}%`}}/></span><strong>{value(day)===null?'측정 전':`${number(value(day)!)}${metric==='answers'?'문제':'분'}`}</strong></button>)}</div>{selectedDay && <p className="analytics-detail" aria-live="polite">{weekdays[selected]}요일 · 최근 8번 중 {selectedDay.activeDays}일 학습 · 시간 측정 가능 {selectedDay.measuredDays}일</p>}<p className="analytics-note">풀이 수는 미학습일을 포함한 요일별 8일 평균이에요. 학습 시간은 측정 시작 이후 날짜만 평균에 포함해요. 시간 기록은 실제 집중도를 직접 측정한 값은 아니에요.</p></>
  }}</InsightCard>
}
function Activities() {
  const {label} = useAnalyticsPeriod()
  const [selected,setSelected] = useState('analysis')
  const types = [{type:'analysis',name:'문장 분석',unit:'건'},{type:'vocabulary',name:'단어 저장',unit:'건'},{type:'quiz',name:'테스트 첫 답안',unit:'문제'},{type:'story',name:'스토리 생성',unit:'편'}]
  return <InsightCard title="학습 활동 구성" description={`${label} · 활동별 사용 건수`}>{data=>{
    const counts = types.map(item=>({...item,count:data.activities.find(row=>row.type===item.type)?.count??0}))
    const max = Math.max(1,...counts.map(item=>item.count))
    const detail = counts.find(item=>item.type===selected)!
    return <><div className="analytics-horizontal activities">{counts.map(item=><button type="button" key={item.type} aria-pressed={selected===item.type} onClick={()=>setSelected(item.type)}><span>{item.name}</span><span className="analytics-track"><i style={{width:`${item.count/max*100}%`}}/></span><strong>{number(item.count)}{item.unit}</strong></button>)}</div><p className="analytics-detail" aria-live="polite">{detail.name} · {number(detail.count)}{detail.unit}</p><p className="analytics-note">활동마다 단위가 달라 실력 점수나 학습 비중으로 환산하지 않아요. 테스트는 재도전을 제외한 첫 답안, 스토리는 저장된 생성 이력 기준이에요. 문장 분석과 단어 저장은 기록된 활동 건수예요.</p></>
  }}</InsightCard>
}
function Languages() {
  const {label} = useAnalyticsPeriod()
  const [metric,setMetric] = useState<'saved'|'learned'|'mastered'|'answers'>('saved')
  const [selected,setSelected] = useState<string|null>(null)
  const words = useQuery({queryKey:['vocabularies'],queryFn:()=>getVocabularies(),enabled:selected!==null})
  const metricLabel = {saved:'저장',learned:'학습',mastered:'마스터',answers:'풀이'}
  const filtered = (words.data??[]).filter(word=>word.languageCode===selected && (metric==='mastered'?word.progress.masteryLevel>=6:metric==='learned'?word.progress.totalAttempts>0:true))
  return <><InsightCard title="언어별 학습 현황" description={metric==='answers'?`${label} · 첫 답안 풀이`:'현재 보관 중인 단어 기준'}>{data=>{
    const max = Math.max(1,...data.languages.map(item=>item[metric]))
    return <><div className="analytics-switch" role="group" aria-label="언어별 학습 지표">{(['saved','learned','mastered','answers'] as const).map(item=><button type="button" key={item} aria-pressed={item===metric} onClick={()=>setMetric(item)}>{metricLabel[item]}</button>)}</div><div className="analytics-horizontal languages">{data.languages.map(item=><button type="button" key={item.language} onClick={()=>setSelected(item.language)} aria-label={`${languageName(item.language)} ${metricLabel[metric]} ${item[metric]}${metric==='answers'?'문제':'개'}, 보관 단어 목록 보기`}><span>{languageName(item.language)}</span><span className="analytics-track"><i style={{width:`${item[metric]/max*100}%`}}/></span><strong>{number(item[metric])}{metric==='answers'?'문제':'개'}</strong></button>)}</div>{!data.languages.length && <p>아직 저장된 단어나 학습 기록이 없어요.</p>}<p className="analytics-note">저장·학습·마스터는 현재 상태이며, 학습은 첫 답안 기록이 있는 단어, 마스터는 6~7단계예요. 풀이 수는 선택 기간의 기록으로 삭제한 단어의 보존 답안도 포함해요. 막대를 누르면 해당 언어의 현재 보관 단어를 확인할 수 있어요.</p></>
  }}</InsightCard><Modal open={selected!==null} title={`${selected?languageName(selected):''} 보관 단어`} description={metric==='answers'?'현재 보관 중인 단어 목록이에요. 기간별 풀이 수와 다를 수 있어요.':`${metricLabel[metric]} 단어 목록이에요.`} onClose={()=>setSelected(null)} size="large">{words.isPending?<p role="status">단어를 불러오는 중이에요.</p>:words.isError?<div role="alert"><p>단어를 불러오지 못했어요.</p><button type="button" className="primary" onClick={()=>void words.refetch()}>다시 시도</button></div>:<><p>총 {filtered.length}개</p><ul className="analytics-word-list">{filtered.map(word=><li key={word.vocabularyId}><strong>{word.word}</strong><p>{word.meaning}</p></li>)}</ul>{!filtered.length&&<p>해당하는 보관 단어가 없어요.</p>}</>}</Modal></>
}
function Growth() {
  const {label} = useAnalyticsPeriod()
  const [selected,setSelected] = useState<string>()
  return <InsightCard title="누적 XP 성장 곡선" description={`${label} · XP 원장 기준`}>{data=>{
    const points = [{date:'opening',earnedXp:0,totalXp:data.growth.openingXp,level:0,levelsGained:0,grade:''},...data.growth.days]
    const max = Math.max(1,...points.map(point=>point.totalXp))
    const active = points.find(point=>point.date===selected)??points.at(-1)!
    const x = (index:number)=>(index+.5)/points.length*700
    const y = (xp:number)=>160-xp/max*150
    const path = points.map((point,index)=>`${index?'L':'M'} ${x(index)} ${y(point.totalXp)}`).join(' ')
    const earned = data.growth.days.reduce((sum,day)=>sum+day.earnedXp,0)
    return <><div className="analytics-growth-summary"><div><span>기간 마지막 누적 XP</span><strong>{number(points.at(-1)!.totalXp)} XP</strong></div><div><span>기간 획득 XP</span><strong>+{number(earned)} XP</strong></div></div><div className="analytics-chart-scroll"><div className="analytics-growth-chart" style={{minWidth:points.length>14?points.length*64:undefined}}><div className="analytics-growth-axis" aria-hidden="true"><span>{number(max)}</span><span>{number(max/2)}</span><span>0 XP</span></div><div className="analytics-growth-columns" style={{gridTemplateColumns:`repeat(${points.length},minmax(0,1fr))`}}><svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-hidden="true">{[10,85,160].map(row=><line key={row} x1="0" x2="700" y1={row} y2={row} className="growth-grid"/>)}<path d={path}/></svg>{points.map(point=><button type="button" key={point.date} aria-pressed={point.date===active.date} onClick={()=>setSelected(point.date)} aria-label={`${point.date==='opening'?'기간 시작 전':formatAnalyticsDate(point.date,data.range.grain)}, 누적 ${point.totalXp} XP${point.levelsGained?`, ${point.levelsGained}레벨 상승`:''}`}><span className={`growth-dot ${point.levelsGained?'milestone':''}`} style={{top:y(point.totalXp)}}/><span className="growth-hit"/><span>{point.date==='opening'?'시작 전':formatAnalyticsDate(point.date,data.range.grain)}</span>{point.levelsGained>0&&<small>Lv.{point.level}</small>}</button>)}</div></div></div><div className="analytics-detail" aria-live="polite">{active.date==='opening'?'기간 시작 전':formatAnalyticsDate(active.date,data.range.grain)} · {number(active.totalXp)} XP{active.date!=='opening'&&<> · +{number(active.earnedXp)} XP · Lv.{active.level} {active.grade}{active.levelsGained>0?` · ${active.levelsGained}레벨 상승`:''}</>}</div><p className="analytics-note">시작 전 누적 XP를 포함하며 노란 점은 해당 구간에 레벨이 오른 경우예요. 레벨과 등급은 앱의 성장 규칙으로 계산해요. 과거 XP 원장에 없는 잔액은 시작 전 XP에 반영해요.</p></>
  }}</InsightCard>
}
export default function LearningInsightsCharts({kind}:{kind:'weekdays'|'activities'|'languages'|'growth'}) {
  return kind==='weekdays'?<Weekdays/>:kind==='activities'?<Activities/>:kind==='languages'?<Languages/>:<Growth/>
}
