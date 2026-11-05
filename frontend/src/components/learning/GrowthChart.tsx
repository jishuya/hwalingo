import { useEffect, useId, useRef, useState } from 'react'
import { formatAnalyticsDate, type LearningInsights } from '../../services/analytics'
import './GrowthChart.css'

type Point = LearningInsights['growth']['days'][number]
const number = (value:number) => value.toLocaleString('ko-KR', { maximumFractionDigits:1 })
const clamp = (value:number, min:number, max:number) => Math.max(min, Math.min(max, value))

export default function GrowthChart({ points, grain, selected, onSelect }: {
  points:Point[]; grain:LearningInsights['range']['grain']; selected:string; onSelect:(date:string)=>void
}) {
  const plot = useRef<HTMLDivElement>(null)
  const [width,setWidth] = useState(0)
  const tooltipId = useId()
  const [tooltipDate,setTooltipDate] = useState<string|null>(null)
  useEffect(()=>{
    const dismiss = (event:PointerEvent) => {
      if (!plot.current?.contains(event.target as Node)) setTooltipDate(null)
    }
    const escape = (event:KeyboardEvent) => { if (event.key==='Escape') setTooltipDate(null) }
    document.addEventListener('pointerdown',dismiss)
    document.addEventListener('keydown',escape)
    return ()=>{ document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape) }
  },[])
  const days = points.filter(point=>point.date!=='opening')
  const visible = days.length ? days : points
  const count = visible.length
  const highestXp = Math.max(1,...visible.map(point=>point.totalXp))
  const axisCeiling = highestXp*1.2
  let axisScale = 10 ** Math.max(0,Math.floor(Math.log10(axisCeiling))-2)
  if (Math.ceil(axisCeiling/axisScale/2)*2>999) axisScale *= 10
  const axisMaximum = Math.ceil(axisCeiling/axisScale/2)*2
  const max = axisMaximum*axisScale
  const label = (point:Point) => point.date==='opening'?'시작 전':formatAnalyticsDate(point.date,grain)
  useEffect(()=>{
    const element = plot.current
    if (!element) return
    const observer = new ResizeObserver(entries=>setWidth(entries[0].contentRect.width))
    observer.observe(element)
    return ()=>observer.disconnect()
  },[])
  const showEveryDay = grain==='day' && count<=7
  const showPointValues = width/count>=78
  const labelSlots = Math.max(2,Math.floor(width/90))
  const stride = Math.max(1,Math.ceil((count-1)/Math.max(1,labelSlots-1)))
  const x = (index:number) => (index+.5)/count*700
  const y = (xp:number) => 160-xp/max*150
  const path = visible.map((point,index)=>`${index?'L':'M'} ${x(index)} ${y(point.totalXp)}`).join(' ')
  const tooltipIndex = visible.findIndex(point=>point.date===tooltipDate)
  const tooltip = visible[tooltipIndex]
  const tooltipBelow = tooltip ? y(tooltip.totalXp)<90 : false
  const tooltipX = clamp((tooltipIndex+.5)/count*width,Math.min(84,width/2),Math.max(width-84,width/2))
  return <div className="growth-chart-view">
    <div className="analytics-growth-chart growth-fit-chart">
      <span className="growth-axis-unit">단위: XP{axisScale>1?` ×${number(axisScale)}`:''}</span>
      <div className="analytics-growth-axis" aria-hidden="true"><span>{axisMaximum}</span><span>{axisMaximum/2}</span><span>0</span></div>
      <div ref={plot} className="analytics-growth-columns" role="group" aria-label="선택 기간별 누적 XP" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>
        <svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="report-growth-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".22"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs><path className="growth-area" d={`${path} L ${x(count-1)} 160 L ${x(0)} 160 Z`}/>{[10,85,160].map(row=><line key={row} x1="0" x2="700" y1={row} y2={row} className="growth-grid"/>)}<path d={path}/></svg>
        {visible.map((point,index)=>{
          const showLabel = showEveryDay || index===count-1 || (index%stride===0 && (index===0 || index<count-1-Math.ceil(stride/2)))
          return <button type="button" key={point.date} aria-pressed={point.date===selected} aria-describedby={tooltipDate===point.date?tooltipId:undefined} onFocus={()=>setTooltipDate(point.date)} onClick={()=>{onSelect(point.date);setTooltipDate(point.date)}} aria-label={`${point.date==='opening'?'기간 시작 전':label(point)}, 누적 ${point.totalXp} XP${point.levelsGained?`, ${point.levelsGained}레벨 상승`:''}`}>
            {(showLabel || point.date===selected || point.levelsGained>0)&&<span className={`growth-dot ${point.levelsGained?'milestone':''}`} style={{top:y(point.totalXp)}}/>}<span className="growth-hit"/>
            {showLabel&&<span className={`growth-tick ${index===0?'first':index===count-1?'last':''}`}><span className="growth-date">{label(point)}</span>{showPointValues&&<><strong>{number(point.totalXp)} XP</strong>{point.levelsGained>0&&<small>Lv.{point.level}</small>}</>}</span>}
          </button>
        })}
        {tooltip&&<div id={tooltipId} role="tooltip" className={`growth-tooltip${tooltipBelow?' below':''}`} style={{left:tooltipX,top:y(tooltip.totalXp)+(tooltipBelow?12:-12)}}>
          <span>{tooltip.date==='opening'?'기간 시작 전':label(tooltip)}</span>
          <strong>누적 {number(tooltip.totalXp)} XP</strong>
          {tooltip.date!=='opening'&&<small>획득 +{number(tooltip.earnedXp)} XP · Lv.{tooltip.level}</small>}
        </div>}
      </div>
    </div>
  </div>
}
