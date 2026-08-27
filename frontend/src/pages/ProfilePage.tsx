import { BookOpenIcon, ChartBarIcon, ClockCounterClockwiseIcon, ImageIcon, TrophyIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import Icon from '../components/Icon'
import LevelAvatar from '../components/profile/LevelAvatar'
import LevelAvatarGallery from '../components/profile/LevelAvatarGallery'
import { AlertDialog, ConfirmDialog, Modal } from '../components/ui/Dialog'
import { changePassword, deleteAccount, updateProfile, type AuthUser } from '../services/auth'
import { getUserProgress } from '../services/progress'
import { getUserSettings, updateUserSettings, type Theme, type UserSettings } from '../services/settings'
import { sendSupportInquiry } from '../services/support'
import type { Page } from '../types/navigation'

interface ProfilePageProps { user: AuthUser; logout: () => Promise<void>; onNavigate: (page: Page) => void }
type Panel = 'details' | 'profile' | 'password' | 'settings' | 'help' | 'account' | null
const themeLabels: Record<Theme, string> = { light: '밝게', dark: '어둡게', system: '시스템 설정' }
const timezones = [{ value: 'Asia/Seoul', label: '서울' }, { value: 'Asia/Tokyo', label: '도쿄' }, { value: 'UTC', label: 'UTC' }, { value: 'America/New_York', label: '뉴욕' }, { value: 'Europe/London', label: '런던' }]

export default function ProfilePage({ user, logout, onNavigate }: ProfilePageProps) {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<Panel>(null)
  const [avatarsOpen, setAvatarsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [alert, setAlert] = useState<{ title: string; message: string; tone: 'success' | 'warning' }>()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [inquiryCategory, setInquiryCategory] = useState('사용 방법')
  const [inquiryMessage, setInquiryMessage] = useState('')
  const progressQuery = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress })
  const settingsQuery = useQuery({ queryKey: ['settings', 'me'], queryFn: getUserSettings })
  const [settingsDraft, setSettingsDraft] = useState<UserSettings>()
  const openSettings = () => { setSettingsDraft(settingsQuery.data); setPanel('settings') }

  const profileMutation = useMutation({ mutationFn: () => updateProfile(displayName), onSuccess: result => {
    queryClient.setQueryData(['auth', 'me'], result); setPanel(null)
    setAlert({ title: '프로필 저장 완료', message: '이름이 변경되었습니다.', tone: 'success' })
  } })
  const passwordMutation = useMutation({ mutationFn: () => changePassword(currentPassword, newPassword), onSuccess: () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPanel(null)
    setAlert({ title: '비밀번호 변경 완료', message: '새 비밀번호가 적용되었습니다.', tone: 'success' })
  } })
  const settingsMutation = useMutation({ mutationFn: updateUserSettings, onSuccess: value => {
    queryClient.setQueryData(['settings', 'me'], value); void queryClient.invalidateQueries({ queryKey: ['progress', 'me'] }); setPanel(null)
    setAlert({ title: '설정 저장 완료', message: '학습 환경 설정이 저장되었습니다.', tone: 'success' })
  } })
  const deleteMutation = useMutation({ mutationFn: () => deleteAccount(deletePassword), onError: () => setDeleteConfirmOpen(false), onSuccess: () => {
    queryClient.clear(); onNavigate('login')
  } })
  const inquiryMutation = useMutation({ mutationFn: () => sendSupportInquiry({ category: inquiryCategory, message: inquiryMessage }), onSuccess: () => {
    setInquiryMessage(''); setPanel(null); setAlert({ title: '문의 전송 완료', message: '문의가 접수되었습니다. 가입한 이메일로 답변드릴게요.', tone: 'success' })
  } })
  const progress = progressQuery.data
  const level = progress?.level ?? 1
  const weeklyPercent = progress ? Math.min(100, (progress.weeklyCompletedDays / progress.weeklyGoalDays) * 100) : 0
  const maxMasteryCount = Math.max(1, ...(progress?.masteryDistribution.map(item => item.wordCount) ?? [1]))
  const submitPassword = (event: FormEvent) => { event.preventDefault(); if (newPassword === confirmPassword) passwordMutation.mutate() }
  const confirmLogout = async () => {
    setLogoutPending(true)
    try { await logout() } catch { setLogoutPending(false); setLogoutOpen(false); setAlert({ title: '로그아웃 실패', message: '잠시 후 다시 시도해주세요.', tone: 'warning' }) }
  }

  return <div className="page profile-page">
    <section className="profile-card card">
      <div className="profile-level-avatar"><LevelAvatar className="profile-level-avatar-image" level={level} eager/><span>Lv.{level}</span><button type="button" onClick={() => setAvatarsOpen(true)} aria-label="레벨 프로필 전체 보기"><ImageIcon weight="duotone"/></button></div>
      <h1>{user.displayName}</h1><p>{user.email}</p><button type="button" className="profile-edit-button" onClick={() => { setDisplayName(user.displayName); setPanel('profile') }}>프로필 수정</button>
      <div className="badges"><span>🏅 {progress?.rank ?? 'Cadet'}</span><span>◎ Level {level}</span><span>🔥 {progress?.currentStreak ?? 0}일 연속</span></div>
      {progress && <><div className="profile-xp"><div><span>{progress.currentLevelXp} XP</span><b>{progress.nextLevelXp ? `${progress.nextLevelXp} XP` : 'MAX'}</b></div><div><i style={{ width: `${progress.progressPercent}%` }}/></div><small>누적 {progress.totalXp} XP</small></div><div className="weekly-goal"><div><span>이번 주 학습</span><b>{progress.weeklyCompletedDays} / {progress.weeklyGoalDays}일</b></div><div><i style={{ width: `${weeklyPercent}%` }}/></div><small>{progress.weeklyCompletedDays >= progress.weeklyGoalDays ? '이번 주 목표를 달성했어요!' : `${progress.weeklyGoalDays - progress.weeklyCompletedDays}일 더 학습하면 목표 달성`}</small></div></>}
    </section>
    <section className="card settings"><div className="setting-head"><h2>학습 현황</h2><button type="button" onClick={() => setPanel('details')}>자세히 ›</button></div><div className="stats"><button type="button" onClick={() => onNavigate('vocabulary')}><b>{progress?.savedWords ?? 0}</b><span>저장 단어</span></button><div><b>{progress?.masteredWords ?? 0}</b><span>마스터</span></div><button type="button" onClick={() => onNavigate('quiz')}><b>{progress?.dueWords ?? 0}</b><span>복습 예정</span></button></div><hr/><h2>저장한 항목</h2><div className="saved"><Icon>◆</Icon><p><b>{progress?.savedWords ?? 0}개의 단어</b><br/><span>저장한 단어와 표현을 복습해 보세요.</span></p><button type="button" onClick={() => onNavigate(progress?.dueWords ? 'quiz' : 'vocabulary')}>{progress?.dueWords ? '복습하기' : '단어장 보기'}</button></div><hr/><h2>설정 및 환경</h2>
      <button type="button" className="setting-row" onClick={openSettings}>🔔 알림 · {settingsQuery.data?.notificationsEnabled === false ? '끔' : '켬'}<span>›</span></button><button type="button" className="setting-row" onClick={openSettings}>◐ 화면 모드 · {settingsQuery.data ? themeLabels[settingsQuery.data.theme] : '불러오는 중'}<span>›</span></button><button type="button" className="setting-row" onClick={() => setPanel('password')}>🔒 비밀번호 변경<span>›</span></button><button type="button" className="setting-row" onClick={() => setPanel('help')}>? 도움말 및 지원<span>›</span></button><button type="button" className="setting-row account-row" onClick={() => { setDeletePassword(''); setPanel('account') }}>⚙ 계정 관리<span>›</span></button><button type="button" className="logout" onClick={() => setLogoutOpen(true)}>↪ 로그아웃</button>
    </section>
    <LevelAvatarGallery open={avatarsOpen} currentLevel={level} onClose={() => setAvatarsOpen(false)}/>
    <Modal open={panel === 'details'} title="학습 현황" description="지금까지 쌓은 학습 기록이에요." onClose={() => setPanel(null)} size="large"><div className="profile-detail-grid"><article><BookOpenIcon weight="duotone"/><span>저장 단어</span><b>{progress?.savedWords ?? 0}개</b></article><article><TrophyIcon weight="duotone"/><span>마스터</span><b>{progress?.masteredWords ?? 0}개</b></article><article><ClockCounterClockwiseIcon weight="duotone"/><span>복습 예정</span><b>{progress?.dueWords ?? 0}개</b></article><article><ChartBarIcon weight="duotone"/><span>누적 경험치</span><b>{progress?.totalXp ?? 0} XP</b></article></div><dl className="profile-detail-list"><div><dt>현재 레벨</dt><dd>Lv.{level} · {progress?.rank ?? 'Cadet'}</dd></div><div><dt>퀴즈 정답률</dt><dd>{progress?.accuracyPercent ?? 0}% ({progress?.correctAnswers ?? 0}/{progress?.totalAnswers ?? 0})</dd></div><div><dt>현재 연속 학습</dt><dd>{progress?.currentStreak ?? 0}일</dd></div><div><dt>최장 연속 학습</dt><dd>{progress?.longestStreak ?? 0}일</dd></div><div><dt>이번 주 목표</dt><dd>{progress?.weeklyCompletedDays ?? 0} / {progress?.weeklyGoalDays ?? 5}일</dd></div></dl>
      <section className="profile-mastery-chart"><h3>숙련도 분포</h3><div>{progress?.masteryDistribution.map(item => <article key={item.masteryLevel}><span>Lv.{item.masteryLevel}</span><div><i style={{ width: `${(item.wordCount / maxMasteryCount) * 100}%` }}/></div><b>{item.wordCount}</b></article>)}</div></section>
      <section className="profile-week-chart"><h3>최근 7일 학습</h3><div>{progress?.recentLearningDays.map(item => { const date = new Date(`${item.date}T00:00:00`); return <article key={item.date} title={`${item.earnedXp} XP · ${item.reviewedWordCount}단어 복습`}><b>{item.activityCount > 0 ? item.activityCount : ''}</b><i className={item.activityCount > 0 ? 'active' : ''}/><span>{date.toLocaleDateString('ko-KR', { weekday: 'short' })}</span></article> })}</div></section>
    </Modal>
    <Modal open={panel === 'profile'} title="프로필 수정" onClose={() => setPanel(null)} footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" type="button" disabled={profileMutation.isPending || displayName === user.displayName} onClick={() => profileMutation.mutate()}>저장</button></>}><label className="profile-form-field"><span>이름</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={20}/><small>띄어쓰기 없이 한글과 영문 2~20자</small></label>{profileMutation.isError && <p className="profile-form-error">{profileMutation.error.message}</p>}</Modal>
    <Modal open={panel === 'password'} title="비밀번호 변경" onClose={() => setPanel(null)}><form className="profile-form" onSubmit={submitPassword}><label className="profile-form-field"><span>현재 비밀번호</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></label><label className="profile-form-field"><span>새 비밀번호</span><input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} maxLength={72} required/><small>8자 이상, 특수문자 1개 포함</small></label><label className="profile-form-field"><span>새 비밀번호 확인</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required/></label>{confirmPassword && newPassword !== confirmPassword && <p className="profile-form-error">새 비밀번호가 서로 일치하지 않습니다.</p>}{passwordMutation.isError && <p className="profile-form-error">{passwordMutation.error.message}</p>}<div className="profile-form-actions"><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" disabled={passwordMutation.isPending || newPassword !== confirmPassword}>변경</button></div></form></Modal>
    <Modal open={panel === 'settings'} title="학습 환경 설정" description="학습 기록과 화면에 적용할 설정을 선택하세요." onClose={() => setPanel(null)} footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" type="button" disabled={!settingsDraft || settingsMutation.isPending} onClick={() => settingsDraft && settingsMutation.mutate(settingsDraft)}>저장</button></>}>{settingsDraft && <div className="profile-settings-form"><label><span>화면 모드</span><select value={settingsDraft.theme} onChange={event => setSettingsDraft({ ...settingsDraft, theme: event.target.value as Theme })}><option value="light">밝게</option><option value="dark">어둡게</option><option value="system">시스템 설정</option></select></label><label><span>주간 학습 목표</span><select value={settingsDraft.weeklyGoalDays} onChange={event => setSettingsDraft({ ...settingsDraft, weeklyGoalDays: Number(event.target.value) })}>{[1,2,3,4,5,6,7].map(day => <option key={day} value={day}>주 {day}일</option>)}</select></label><label><span>시간대</span><select value={settingsDraft.timezone} onChange={event => setSettingsDraft({ ...settingsDraft, timezone: event.target.value })}>{timezones.map(item => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</select></label><label className="profile-toggle"><span><b>학습 알림</b><small>복습과 학습 목표 알림을 받습니다.</small></span><input type="checkbox" checked={settingsDraft.notificationsEnabled} onChange={event => setSettingsDraft({ ...settingsDraft, notificationsEnabled: event.target.checked })}/></label>{settingsMutation.isError && <p className="profile-form-error">{settingsMutation.error.message}</p>}</div>}</Modal>
    <Modal open={panel === 'help'} title="도움말 및 지원" onClose={() => setPanel(null)} size="large"><div className="profile-help"><article><b>저장한 단어는 어디에서 복습하나요?</b><p>단어장 또는 마이페이지의 ‘복습하기’를 누르면 오늘의 테스트를 시작할 수 있어요.</p></article><article><b>숙련도는 어떻게 올라가나요?</b><p>복습 문제를 맞히면 0~7단계 안에서 한 단계씩 올라가며 다음 복습일이 자동으로 정해집니다.</p></article><section className="profile-inquiry"><h3>1:1 문의</h3><p>문의는 <b>jishuya3015@naver.com</b>으로 전달되며, 답변은 {user.email}로 보내드려요.</p><label><span>문의 유형</span><select value={inquiryCategory} onChange={event => setInquiryCategory(event.target.value)}><option>사용 방법</option><option>계정 및 로그인</option><option>학습 및 퀴즈</option><option>오류 신고</option><option>기타</option></select></label><label><span>문의 내용</span><textarea value={inquiryMessage} onChange={event => setInquiryMessage(event.target.value)} minLength={10} maxLength={2000} placeholder="문의 내용을 10자 이상 입력해주세요."/></label><small>{inquiryMessage.length} / 2,000</small>{inquiryMutation.isError && <p className="profile-form-error">{inquiryMutation.error.message}</p>}<button className="ui-dialog-primary" type="button" disabled={inquiryMessage.trim().length < 10 || inquiryMutation.isPending} onClick={() => inquiryMutation.mutate()}>{inquiryMutation.isPending ? '전송 중...' : '문의 보내기'}</button></section></div></Modal>
    <Modal open={panel === 'account'} title="계정 관리" description="회원 탈퇴 시 모든 학습 기록이 영구적으로 삭제됩니다." tone="danger" onClose={() => setPanel(null)}><div className="profile-account-danger"><b>회원 탈퇴</b><p>단어장, 퀴즈 기록, XP, 생성한 스토리를 복구할 수 없습니다.</p><label className="profile-form-field"><span>확인을 위해 현재 비밀번호를 입력해주세요.</span><input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)}/></label>{deleteMutation.isError && <p className="profile-form-error">{deleteMutation.error.message}</p>}<button type="button" disabled={!deletePassword || deleteMutation.isPending} onClick={() => setDeleteConfirmOpen(true)}>회원 탈퇴</button></div></Modal>
    <ConfirmDialog open={deleteConfirmOpen} title="정말 탈퇴할까요?" message={<>계정과 모든 학습 데이터가 영구 삭제되며<br/>이 작업은 되돌릴 수 없습니다.</>} confirmLabel="영구 삭제" cancelLabel="취소" tone="danger" loading={deleteMutation.isPending} onCancel={() => setDeleteConfirmOpen(false)} onConfirm={() => deleteMutation.mutate()}/><ConfirmDialog open={logoutOpen} title="로그아웃할까요?" message="현재 기기에서 로그인 상태가 해제됩니다." confirmLabel="로그아웃" tone="danger" loading={logoutPending} onCancel={() => setLogoutOpen(false)} onConfirm={() => void confirmLogout()}/><AlertDialog open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message ?? ''} tone={alert?.tone ?? 'success'} onClose={() => setAlert(undefined)}/>
  </div>
}
