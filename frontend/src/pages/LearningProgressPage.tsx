import LearningTimeChart from '../components/learning/LearningTimeChart'
import { ArrowLeftIcon, BookOpenIcon, TrophyIcon, ClockCounterClockwiseIcon, ChartBarIcon, FireIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { getUserProgress } from '../services/progress'
import { getCurrentWeek } from '../domain/learningWeek'
import type { Page } from '../types/navigation'

export default function LearningProgressPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const query = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress })
  const progress = query.data
  const hwarangGrade = progress?.hwarangGrade
  const currentWeek = getCurrentWeek(progress?.recentLearningDays ?? [])
  const weeklyTrend = progress?.weeklyLearningTrend ?? []
  const maxWeeklyReviews = Math.max(1, ...weeklyTrend.map(item => item.reviewedWordCount))
  const maxMasteryCount = Math.max(1, ...(progress?.masteryDistribution.map(item => item.wordCount) ?? []))

  return <div className="page learning-progress-page">
    <header className="learning-progress-header">
      <button type="button" onClick={() => onNavigate('profile')}><ArrowLeftIcon weight="bold"/>마이페이지</button>
      <h1>학습 현황</h1>
      <p>꾸준히 쌓아 온 학습 기록을 확인해보세요.</p>
    </header>
    <LearningTimeChart/>
    {query.isPending ? <section className="card learning-progress-content" role="status">학습 기록을 불러오는 중이에요.</section>
      : query.isError ? <section className="card learning-progress-content" role="alert"><p>학습 기록을 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></section>
      : progress && <section className="card learning-progress-content">
<div className="profile-detail-grid"><article><BookOpenIcon weight="duotone"/><span>저장 단어</span><b>{progress?.savedWords ?? 0}개</b></article><article><TrophyIcon weight="duotone"/><span>마스터</span><b>{progress?.masteredWords ?? 0}개</b></article><article><ClockCounterClockwiseIcon weight="duotone"/><span>복습 예정</span><b>{progress?.dueWords ?? 0}개</b></article><article><ChartBarIcon weight="duotone"/><span>누적 경험치</span><b>{progress?.totalXp ?? 0} XP</b></article></div><dl className="profile-detail-list"><div><dt>현재 화랑이 등급</dt><dd>{hwarangGrade?.name} · {hwarangGrade?.step}단계</dd></div><div><dt>현재 단계 XP</dt><dd>{progress?.currentLevelXp ?? 0} / {progress?.nextLevelXp ?? 'MAX'} XP</dd></div><div><dt>다음 단계까지</dt><dd>{progress?.nextLevelXp ? `${Math.max(0, progress.nextLevelXp - progress.currentLevelXp)} XP` : '최고 단계 달성'}</dd></div><div><dt>퀴즈 정답률</dt><dd>{progress?.accuracyPercent ?? 0}% ({progress?.correctAnswers ?? 0}/{progress?.totalAnswers ?? 0})</dd></div><div><dt>현재 연속 학습</dt><dd>{progress?.currentStreak ?? 0}일</dd></div><div><dt>최장 연속 학습</dt><dd>{progress?.longestStreak ?? 0}일</dd></div><div><dt>이번 주 목표</dt><dd>{progress?.weeklyCompletedDays ?? 0} / {progress?.weeklyGoalDays ?? 5}일</dd></div></dl>
      <section className="profile-trend-chart"><div className="profile-chart-heading"><div><h3>주간 학습 추이</h3><p>최근 8주 동안 제출한 첫 답안 수예요. 새 단어와 복습을 모두 포함해요.</p></div><span><i/>첫 답안</span></div><div className="profile-bar-chart">{weeklyTrend.map((item, index) => <article key={item.weekStart} title={`${item.reviewedWordCount}문제 · ${item.earnedXp} XP · ${item.activeDays}일 학습`}><b>{item.reviewedWordCount || ''}</b><div><i style={{ height: `${(item.reviewedWordCount / maxWeeklyReviews) * 100}%` }}/></div><span>{index === weeklyTrend.length - 1 ? '이번 주' : new Date(`${item.weekStart}T00:00:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span></article>)}</div></section>
      <section className="profile-trend-chart profile-accuracy-chart"><div className="profile-chart-heading"><div><h3>주간 정답률</h3><p>최근 8주의 퀴즈 정답률과 응시 기록이에요.</p></div><span><i/>정답률</span></div><div className="profile-accuracy-bars" role="img" aria-label="최근 8주 주간 정답률 막대그래프">{weeklyTrend.map((item, index) => <article key={item.weekStart} title={item.accuracyPercent === null ? '응시 기록 없음' : `${item.accuracyPercent}% · ${item.totalAnswers}문제 응시`}><b>{item.accuracyPercent === null ? '–' : `${item.accuracyPercent}%`}</b><div>{item.accuracyPercent !== null && <i style={{ height: `${item.accuracyPercent}%` }}/>}</div><small>{item.totalAnswers ? `${item.totalAnswers}문제` : '기록 없음'}</small><span>{index === weeklyTrend.length - 1 ? '이번 주' : new Date(`${item.weekStart}T00:00:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span></article>)}</div></section>
      <section className="profile-mastery-chart"><h3>숙련도 분포</h3><div>{progress?.masteryDistribution.map(item => <article key={item.masteryLevel}><span>Lv.{item.masteryLevel}</span><div><i style={{ width: `${(item.wordCount / maxMasteryCount) * 100}%` }}/></div><b>{item.wordCount}</b></article>)}</div></section>
      <section className="profile-week-chart"><h3>이번 주 학습</h3><div className="weekly-goal detail-weekly-goal"><div className="weekly-goal-heading"><span>이번 주 학습</span><b>{progress?.weeklyCompletedDays ?? 0} / {progress?.weeklyGoalDays ?? 5}일</b></div><div className="weekly-goal-days">{currentWeek.map(day => { const completed = Boolean(day.activity?.activityCount); return <div key={day.date} className={completed ? 'completed' : ''} title={completed ? `${day.activity?.earnedXp ?? 0} XP · ${day.activity?.reviewedWordCount ?? 0}문제 풀이` : '아직 학습하지 않았어요'}><span>{day.label}</span><span className="weekly-fire" aria-label={`${day.label}요일 ${completed ? '학습 완료' : '미완료'}`}><FireIcon weight={completed ? 'fill' : 'regular'}/></span></div> })}</div><small>{(progress?.weeklyCompletedDays ?? 0) >= (progress?.weeklyGoalDays ?? 5) ? '이번 주 목표를 달성했어요!' : `${(progress?.weeklyGoalDays ?? 5) - (progress?.weeklyCompletedDays ?? 0)}일 더 학습하면 목표 달성`}</small></div></section>
    
      </section>}
  </div>
}
