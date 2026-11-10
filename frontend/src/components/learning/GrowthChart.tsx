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
  const highestXp = Math.max(1,...visible.map(point=>point.earnedXp))
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
  const y = (xp:number) => 160-xp/max*150
  const tooltipIndex = visible.findIndex(point=>point.date===tooltipDate)
  const tooltip = visible[tooltipIndex]
  const tooltipBelow = tooltip ? y(tooltip.earnedXp)<90 : false
  const tooltipX = clamp((tooltipIndex+.5)/count*width,Math.min(84,width/2),Math.max(width-84,width/2))
  return <div className="growth-chart-view">
    <div className="analytics-growth-chart growth-fit-chart">
      <span className="growth-axis-unit">단위: XP{axisScale>1?` ×${number(axisScale)}`:''}</span>
      <div className="analytics-growth-axis" aria-hidden="true"><span>{axisMaximum}</span><span>{axisMaximum/2}</span><span>0</span></div>
      <div ref={plot} className="analytics-growth-columns" role="group" aria-label="선택 기간별 획득 XP" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>
        <svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-hidden="true">{[10,85,160].map(row=><line key={row} x1="0" x2="700" y1={row} y2={row} className="growth-grid"/>)}</svg>
        {visible.map((point,index)=>{
          const showLabel = showEveryDay || index===count-1 || (index%stride===0 && (index===0 || index<count-1-Math.ceil(stride/2)))
          return <button type="button" key={point.date} aria-pressed={point.date===selected} aria-describedby={tooltipDate===point.date?tooltipId:undefined} onFocus={()=>setTooltipDate(point.date)} onClick={()=>{onSelect(point.date);setTooltipDate(point.date)}} aria-label={`${point.date==='opening'?'기간 시작 전':label(point)}, 획득 ${point.earnedXp} XP, 누적 ${point.totalXp} XP${point.levelsGained?`, ${point.levelsGained}레벨 상승`:''}`}>
            <span aria-hidden="true" className={`growth-earned-bar${point.earnedXp===0?' zero':''}`} style={{height:point.earnedXp>0?160-y(point.earnedXp):0}}/>
            {(showEveryDay || showLabel && showPointValues)&&<span aria-hidden="true" className="growth-earned-value" style={{top:y(point.earnedXp)-22}}>{point.earnedXp>0?'+':''}{number(point.earnedXp)}</span>}
            <span className="growth-hit"/>
            {showLabel&&<span className={`growth-tick ${index===0?'first':index===count-1?'last':''}`}><span className="growth-date">{label(point)}</span></span>}
          </button>
        })}
        {tooltip&&<div id={tooltipId} role="tooltip" className={`growth-tooltip${tooltipBelow?' below':''}`} style={{left:tooltipX,top:y(tooltip.earnedXp)+(tooltipBelow?12:-12)}}>
          <span>{tooltip.date==='opening'?'기간 시작 전':label(tooltip)}</span>
          <strong>획득 +{number(tooltip.earnedXp)} XP</strong>
          {tooltip.date!=='opening'&&<small>누적 {number(tooltip.totalXp)} XP · Lv.{tooltip.level}</small>}
        </div>}
      </div>
    </div>
  </div>
}
