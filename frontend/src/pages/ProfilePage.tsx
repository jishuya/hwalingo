import { useQuery } from '@tanstack/react-query'
import { ImageIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import Icon from '../components/Icon'
import LevelAvatar from '../components/profile/LevelAvatar'
import LevelAvatarGallery from '../components/profile/LevelAvatarGallery'
import type { AuthUser } from '../services/auth'
import { getUserProgress } from '../services/progress'

export default function ProfilePage({ user, logout }: { user: AuthUser; logout: () => Promise<void> }) {
  const [avatarsOpen, setAvatarsOpen] = useState(false)
  const progressQuery = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress })
  const progress = progressQuery.data
  const level = progress?.level ?? 1
  const weeklyPercent = progress ? Math.min(100, (progress.weeklyCompletedDays / progress.weeklyGoalDays) * 100) : 0

  return <div className="page profile-page">
    <section className="profile-card card">
      <div className="profile-level-avatar">
        <LevelAvatar className="profile-level-avatar-image" level={level} eager/>
        <span>Lv.{level}</span>
        <button type="button" onClick={() => setAvatarsOpen(true)} aria-label="레벨 프로필 전체 보기" title="레벨 프로필 전체 보기"><ImageIcon weight="duotone"/></button>
      </div>
      <h1>{user.displayName}</h1><p>{user.email}</p>
      <div className="badges"><span>🏅 {progress?.rank ?? 'Cadet'}</span><span>◎ Level {progress?.level ?? 1}</span><span>🔥 {progress?.currentStreak ?? 0}일 연속</span></div>
      {progress && <><div className="profile-xp"><div><span>{progress.currentLevelXp} XP</span><b>{progress.nextLevelXp ? `${progress.nextLevelXp} XP` : 'MAX'}</b></div><div><i style={{ width: `${progress.progressPercent}%` }}/></div><small>누적 {progress.totalXp} XP</small></div><div className="weekly-goal"><div><span>이번 주 학습</span><b>{progress.weeklyCompletedDays} / {progress.weeklyGoalDays}일</b></div><div><i style={{ width: `${weeklyPercent}%` }}/></div><small>{progress.weeklyCompletedDays >= progress.weeklyGoalDays ? '이번 주 목표를 달성했어요!' : `${progress.weeklyGoalDays - progress.weeklyCompletedDays}일 더 학습하면 목표 달성`}</small></div></>}
    </section>
    <section className="card settings"><div className="setting-head"><h2>학습 현황</h2><button>자세히 ›</button></div><div className="stats"><div><b>{progress?.savedWords ?? 0}</b><span>저장 단어</span></div><div><b>{progress?.masteredWords ?? 0}</b><span>마스터</span></div><div><b>{progress?.dueWords ?? 0}</b><span>복습 예정</span></div></div><hr/><h2>저장한 항목</h2><div className="saved"><Icon>◆</Icon><p><b>{progress?.savedWords ?? 0}개의 단어</b><br/><span>저장한 단어와 표현을 복습해 보세요.</span></p><button>복습하기</button></div><hr/><h2>설정 및 환경</h2>{['🔔 알림','◐ 화면 모드 · 밝게','? 도움말 및 지원'].map(item=><button className="setting-row" key={item}>{item}<span>›</span></button>)}<button className="logout" onClick={() => void logout()}>↪ 로그아웃</button></section>
    <LevelAvatarGallery open={avatarsOpen} currentLevel={level} onClose={() => setAvatarsOpen(false)}/>
  </div>
}
