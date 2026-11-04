import useChartEntrance from '../components/learning/useChartEntrance'
import { useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CalendarCheckIcon, TargetIcon, BookmarkSimpleIcon, ArrowsClockwiseIcon, GearSixIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import LearningWordGrowthChart from '../components/learning/LearningWordGrowthChart'
import LearningWeakWordsChart from '../components/learning/LearningWeakWordsChart'
import LearningMasteryChart from '../components/learning/LearningMasteryChart'
import LearningCalendarChart from '../components/learning/LearningCalendarChart'
import LearningVolumeChart from '../components/learning/LearningVolumeChart'
import LearningTimeChart from '../components/learning/LearningTimeChart'
import LearningInsightsCharts from '../components/learning/LearningInsightsCharts'
import { Modal } from '../components/ui/Dialog'
import CustomSelect from '../components/ui/CustomSelect'
import { getUserSettings, updateUserSettings } from '../services/settings'
import LevelAvatar from '../components/profile/LevelAvatar'
import { getUserProgress } from '../services/progress'
import type { Page } from '../types/navigation'
import './LearningProgressPage.css'
import './LearningVocabularyReport.css'

const tabs = [{id:'records',label:'학습 기록'},{id:'vocabulary',label:'어휘와 복습'},{id:'growth',label:'성장'}] as const
type Tab = typeof tabs[number]['id']
export default function LearningProgressPage({onNavigate,onIncorrectTest}:{onNavigate:(page:Page)=>void;onIncorrectTest:()=>void}) {
  const chartRoot = useRef<HTMLDivElement>(null)
  useChartEntrance(chartRoot)
  const queryClient = useQueryClient()
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalDays, setGoalDays] = useState(5)
  const settingsQuery = useQuery({queryKey:['settings','me'],queryFn:getUserSettings,enabled:goalOpen})
  const goalMutation = useMutation({
    mutationFn: async () => {
      const settings = await getUserSettings()
      return updateUserSettings({...settings,weeklyGoalDays:goalDays})
    },
    onSuccess: settings => {
      queryClient.setQueryData(['settings','me'],settings)
      queryClient.setQueryData(['progress','me'], (previous: Awaited<ReturnType<typeof getUserProgress>> | undefined) => previous ? {...previous,weeklyGoalDays:settings.weeklyGoalDays} : previous)
      void queryClient.invalidateQueries({queryKey:['progress','me']})
      setGoalOpen(false)
    },
  })
  const closeGoal = () => { if (!goalMutation.isPending) setGoalOpen(false) }
  const query = useQuery({queryKey:['progress','me'],queryFn:getUserProgress})
  const [tab,setTab] = useState<Tab>(()=>{
    const value = new URLSearchParams(location.search).get('tab')
    return tabs.find(item=>item.id===value)?.id??'records'
  })
  const selectTab = (value:Tab) => {
    setTab(value)
    const url = new URL(location.href)
    url.searchParams.set('tab',value)
    history.replaceState(null,'',url.pathname+url.search)
  }
  const progress = query.data
  return <div ref={chartRoot} className="page learning-progress-page">
    <header className="learning-progress-header"><button type="button" onClick={()=>onNavigate('profile')}><ArrowLeftIcon weight="bold"/>마이페이지</button><h1>학습 리포트</h1></header>
    {query.isPending?<p role="status">학습 요약을 불러오는 중이에요.</p>:query.isError&&!progress?<div role="alert"><p>학습 요약을 불러오지 못했어요.</p><button type="button" className="primary" onClick={()=>void query.refetch()}>다시 시도</button></div>:progress&&<section className="card analytics-overview" aria-label="현재 학습 요약"><div><span><CalendarCheckIcon/>현재 연속 학습</span><strong>{progress.currentStreak}<small>일</small></strong></div><div><span><TargetIcon/>이번 주 목표<button className="analytics-goal-settings" type="button" aria-label="이번 주 학습 목표 설정" title="학습 목표 설정" onClick={()=>{setGoalDays(progress.weeklyGoalDays);goalMutation.reset();setGoalOpen(true)}}><GearSixIcon weight="bold"/></button></span><strong>{progress.weeklyCompletedDays}<small>/ {progress.weeklyGoalDays}일</small></strong></div><div><span><BookmarkSimpleIcon/>보관 단어</span><strong>{progress.savedWords.toLocaleString('ko-KR')}<small>개</small></strong></div><button type="button" onClick={()=>onNavigate('quiz')}><span><ArrowsClockwiseIcon/>지금 복습 가능</span><strong>{progress.dueWords.toLocaleString('ko-KR')}<small>개</small><ArrowRightIcon weight="bold"/></strong></button></section>}
    <Modal open={goalOpen} title="이번 주 목표 설정" description="일주일에 며칠 학습할지 선택하세요." onClose={closeGoal} footer={<><button type="button" className="ui-dialog-secondary" disabled={goalMutation.isPending} onClick={closeGoal}>취소</button><button type="button" className="ui-dialog-primary" disabled={settingsQuery.isPending||settingsQuery.isError||goalMutation.isPending} onClick={()=>goalMutation.mutate()}>{goalMutation.isPending?'저장 중...':'저장'}</button></>}>
      {settingsQuery.isPending?<p role="status">설정을 불러오는 중이에요.</p>:settingsQuery.isError?<div role="alert"><p>설정을 불러오지 못했어요.</p><button type="button" onClick={()=>void settingsQuery.refetch()}>다시 시도</button></div>:<CustomSelect ariaLabel="주간 학습 목표" value={String(goalDays)} options={[1,2,3,4,5,6,7].map(day=>({value:String(day),label:`주 ${day}일`}))} onChange={value=>setGoalDays(Number(value))}/>}
      {goalMutation.isError&&<p role="alert">{goalMutation.error.message}</p>}
    </Modal>
    <div className="analytics-tabs" role="tablist" aria-label="학습 리포트 분류">{tabs.map((item,index)=><button key={item.id} id={`analytics-tab-${item.id}`} type="button" role="tab" aria-selected={tab===item.id} aria-controls={`analytics-panel-${item.id}`} tabIndex={tab===item.id?0:-1} onClick={()=>selectTab(item.id)} onKeyDown={event=>{
      const next = event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:null
      if(next!==null){event.preventDefault();selectTab(tabs[next].id);document.getElementById(`analytics-tab-${tabs[next].id}`)?.focus()}
    }}>{item.label}</button>)}</div>
    <div id={`analytics-panel-${tab}`} role="tabpanel" aria-labelledby={`analytics-tab-${tab}`} tabIndex={0}>
      {tab==='records'&&<><LearningTimeChart/><LearningVolumeChart/><LearningCalendarChart/><LearningInsightsCharts kind="weekdays"/></>}
      {tab==='vocabulary'&&<><LearningMasteryChart/><LearningWordGrowthChart/><LearningWeakWordsChart onStart={onIncorrectTest}/><LearningInsightsCharts kind="languages"/></>}
      {tab==='growth'&&<>{progress&&<section className="card analytics-growth-hero"><LevelAvatar level={progress.level} sizes="100px"/><div><span>Lv.{progress.level} · {progress.hwarangGrade.name} {progress.hwarangGrade.step}단계</span><h2>{progress.totalXp.toLocaleString('ko-KR')} XP</h2><p>{progress.nextLevelXp?`다음 레벨까지 ${(progress.nextLevelXp-progress.currentLevelXp).toLocaleString('ko-KR')} XP`:'최고 레벨을 달성했어요!'}</p><div role="progressbar" aria-label="현재 레벨 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progressPercent}><i style={{width:`${progress.progressPercent}%`}}/></div></div></section>}<LearningInsightsCharts kind="growth"/></>}
    </div>
  </div>
}
