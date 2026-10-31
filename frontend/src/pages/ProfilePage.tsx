import { BellIcon, CaretRightIcon, FireIcon, GearSixIcon, ListNumbersIcon, LockKeyIcon, MoonStarsIcon, PencilSimpleIcon, QuestionIcon, SignOutIcon, StepsIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import LevelAvatar from '../components/profile/LevelAvatar'
import LevelAvatarGallery from '../components/profile/LevelAvatarGallery'
import { AlertDialog, ConfirmDialog, Modal } from '../components/ui/Dialog'
import CustomSelect from '../components/ui/CustomSelect'
import { changePassword, deleteAccount, updateProfile, type AuthUser } from '../services/auth'
import { getUserProgress } from '../services/progress'
import { getUserSettings, updateUserSettings, type Theme, type UserSettings } from '../services/settings'
import { sendSupportInquiry } from '../services/support'
import { getCurrentWeek } from '../domain/learningWeek'
import type { Page } from '../types/navigation'

interface ProfilePageProps { user: AuthUser; logout: () => Promise<void>; onNavigate: (page: Page) => void }
type Panel = 'profile' | 'password' | 'notifications' | 'appearance' | 'learning' | 'help' | 'account' | null
const themeLabels: Record<Theme, string> = { light: '밝게', dark: '어둡게', system: '시스템 설정' }
const themeOptions = [{ value: 'light', label: '밝게' }, { value: 'dark', label: '어둡게' }, { value: 'system', label: '시스템 설정' }]
const weeklyGoalOptions = [1, 2, 3, 4, 5, 6, 7].map(day => ({ value: String(day), label: `주 ${day}일` }))
const quizQuestionCountPresets = [10, 20, 30, 40] as const
const inquiryOptions = ['사용 방법', '계정 및 로그인', '학습 및 퀴즈', '오류 신고', '기타'].map(value => ({ value, label: value }))
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
  const openSettings = (settingsPanel: 'notifications' | 'appearance' | 'learning') => {
    setSettingsDraft(settingsQuery.data)
    setPanel(settingsPanel)
  }

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
  const hwarangGrade = progress?.hwarangGrade ?? { name: '새싹 학습자', step: 1, maxStep: 10, index: 0 }
  const currentWeek = getCurrentWeek(progress?.recentLearningDays ?? [])
  const submitPassword = (event: FormEvent) => { event.preventDefault(); if (newPassword === confirmPassword) passwordMutation.mutate() }
  const confirmLogout = async () => {
    setLogoutPending(true)
    try { await logout() } catch { setLogoutPending(false); setLogoutOpen(false); setAlert({ title: '로그아웃 실패', message: '잠시 후 다시 시도해주세요.', tone: 'warning' }) }
  }

  return <div className="page profile-page">
    <section className="profile-card card">
      <div className="profile-level-avatar"><LevelAvatar className="profile-level-avatar-image" level={level} eager sizes="(max-width: 600px) 128px, 148px"/><span>{hwarangGrade.step}단계</span></div>
      <div className="profile-name-row"><h1>{user.displayName}</h1><button type="button" aria-label="이름 변경" title="이름 변경" onClick={() => { setDisplayName(user.displayName); setPanel('profile') }}><PencilSimpleIcon weight="bold"/></button></div><p>{user.email}</p>
      <button type="button" className="profile-growth-collection" onClick={() => setAvatarsOpen(true)}><StepsIcon weight="duotone"/><span>화랑이 성장 도감</span><small>{Math.min(level, 50)} / 50 달성</small></button>
      <div className="badges"><span>◎ {hwarangGrade.name} · {hwarangGrade.step}단계</span><span>🔥 {progress?.currentStreak ?? 0}일 연속</span></div>
    </section>
    <section className="card settings"><div className="setting-head profile-learning-head"><h2><button type="button" className="profile-learning-title" onClick={() => onNavigate('learning-progress')}>학습 현황</button></h2><button type="button" onClick={() => onNavigate('learning-progress')}>자세히 <CaretRightIcon weight="bold"/></button></div><div className="profile-learning-overview"><div className="profile-learning-summary"><span><FireIcon weight="fill"/></span><div><b>이번 주 {progress?.weeklyCompletedDays ?? 0}일 학습</b><small>{(progress?.weeklyCompletedDays ?? 0) >= (progress?.weeklyGoalDays ?? 5) ? '이번 주 목표를 달성했어요!' : `목표까지 ${(progress?.weeklyGoalDays ?? 5) - (progress?.weeklyCompletedDays ?? 0)}일 남았어요`}</small></div><strong>{progress?.weeklyCompletedDays ?? 0} / {progress?.weeklyGoalDays ?? 5}일</strong></div><div className="profile-learning-week">{currentWeek.map(day => { const completed = Boolean(day.activity?.activityCount); return <div key={day.date} className={completed ? 'completed' : ''}><span>{day.label}</span><i title={completed ? `${day.activity?.earnedXp ?? 0} XP 획득` : '학습 기록 없음'}><FireIcon weight={completed ? 'fill' : 'regular'}/></i></div> })}</div><div className="profile-learning-progress" role="progressbar" aria-label="이번 주 학습 목표" aria-valuemin={0} aria-valuemax={progress?.weeklyGoalDays ?? 5} aria-valuenow={progress?.weeklyCompletedDays ?? 0}><i style={{ width: `${Math.min(100, ((progress?.weeklyCompletedDays ?? 0) / (progress?.weeklyGoalDays ?? 5)) * 100)}%` }}/></div></div><div className="profile-learning-stats"><button type="button" onClick={() => onNavigate('quiz')}><span>복습 예정</span><b>{progress?.dueWords ?? 0}<small>개</small></b></button><div><span>정답률</span><b>{progress?.accuracyPercent ?? 0}<small>%</small></b></div><div><span>마스터</span><b>{progress?.masteredWords ?? 0}<small>개</small></b></div></div>{progress && <div className="profile-learning-xp"><div><span>다음 단계까지</span><b>{progress.nextLevelXp ? `${Math.max(0, progress.nextLevelXp - progress.currentLevelXp)} XP` : '최고 단계'}</b></div><div role="progressbar" aria-label="다음 단계 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progressPercent}><i style={{ width: `${progress.progressPercent}%` }}/></div></div>}<hr/><h2>설정 및 환경</h2>
      <div className="setting-list"><button type="button" className="setting-row" onClick={() => openSettings('notifications')}><span className="setting-row-icon"><BellIcon weight="duotone"/></span><span className="setting-row-copy"><b>알림</b><small>{settingsQuery.data?.notificationsEnabled === false ? '끔' : '켬'}</small></span><CaretRightIcon className="setting-row-arrow" weight="bold"/></button><button type="button" className="setting-row" onClick={() => openSettings('appearance')}><span className="setting-row-icon"><MoonStarsIcon weight="duotone"/></span><span className="setting-row-copy"><b>화면 모드</b><small>{settingsQuery.data ? themeLabels[settingsQuery.data.theme] : '불러오는 중'}</small></span><CaretRightIcon className="setting-row-arrow" weight="bold"/></button><button type="button" className="setting-row" onClick={() => openSettings('learning')}><span className="setting-row-icon"><ListNumbersIcon weight="duotone"/></span><span className="setting-row-copy"><b>학습 환경 설정</b><small>{settingsQuery.data ? `주 ${settingsQuery.data.weeklyGoalDays}일, ${settingsQuery.data.quizQuestionCount}문제` : '불러오는 중'}</small></span><CaretRightIcon className="setting-row-arrow" weight="bold"/></button><button type="button" className="setting-row" onClick={() => setPanel('password')}><span className="setting-row-icon"><LockKeyIcon weight="duotone"/></span><span className="setting-row-copy"><b>비밀번호 변경</b></span><CaretRightIcon className="setting-row-arrow" weight="bold"/></button><button type="button" className="setting-row" onClick={() => setPanel('help')}><span className="setting-row-icon"><QuestionIcon weight="duotone"/></span><span className="setting-row-copy"><b>도움말 및 지원</b></span><CaretRightIcon className="setting-row-arrow" weight="bold"/></button><button type="button" className="setting-row account-row" onClick={() => { setDeletePassword(''); setPanel('account') }}><span className="setting-row-icon"><GearSixIcon weight="duotone"/></span><span className="setting-row-copy"><b>계정 관리</b></span><CaretRightIcon className="setting-row-arrow" weight="bold"/></button></div><button type="button" className="logout" onClick={() => setLogoutOpen(true)}><SignOutIcon weight="bold"/>로그아웃</button>
    </section>
    <LevelAvatarGallery open={avatarsOpen} currentLevel={level} onClose={() => setAvatarsOpen(false)}/>
    <Modal open={panel === 'profile'} title="이름 변경" onClose={() => setPanel(null)} footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" type="button" disabled={profileMutation.isPending || displayName === user.displayName} onClick={() => profileMutation.mutate()}>저장</button></>}><label className="profile-form-field"><span>이름</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={20}/><small>띄어쓰기 없이 한글과 영문 2~20자</small></label>{profileMutation.isError && <p className="profile-form-error">{profileMutation.error.message}</p>}</Modal>
    <Modal open={panel === 'password'} title="비밀번호 변경" onClose={() => setPanel(null)} footer={<button className="ui-dialog-primary" type="submit" form="password-change-form" disabled={passwordMutation.isPending || !newPassword || newPassword !== confirmPassword}>{passwordMutation.isPending ? '변경 중...' : '변경하기'}</button>}><form id="password-change-form" className="profile-form" onSubmit={submitPassword}><label className="profile-form-field"><span>현재 비밀번호</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></label><label className="profile-form-field"><span>새 비밀번호</span><input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} maxLength={72} required/><small>8자 이상, 특수문자 1개 포함</small></label><label className="profile-form-field"><span>새 비밀번호 확인</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required/></label>{confirmPassword && newPassword !== confirmPassword && <p className="profile-form-error">새 비밀번호가 서로 일치하지 않습니다.</p>}{passwordMutation.isError && <p className="profile-form-error">{passwordMutation.error.message}</p>}</form></Modal>
    <Modal open={panel === 'notifications'} title="알림" description="학습 알림 수신 여부를 설정하세요." onClose={() => setPanel(null)} footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" type="button" disabled={!settingsDraft || settingsMutation.isPending} onClick={() => settingsDraft && settingsMutation.mutate(settingsDraft)}>저장</button></>}>{settingsDraft && <div className="profile-settings-form"><label className="profile-toggle"><span><b>학습 알림</b><small>복습과 학습 목표 알림을 받습니다.</small></span><input type="checkbox" checked={settingsDraft.notificationsEnabled} onChange={event => setSettingsDraft({ ...settingsDraft, notificationsEnabled: event.target.checked })}/></label>{settingsMutation.isError && <p className="profile-form-error">{settingsMutation.error.message}</p>}</div>}</Modal>
    <Modal open={panel === 'appearance'} title="화면 모드" description="앱에 적용할 화면 모드를 선택하세요." onClose={() => setPanel(null)} footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" type="button" disabled={!settingsDraft || settingsMutation.isPending} onClick={() => settingsDraft && settingsMutation.mutate(settingsDraft)}>저장</button></>}>{settingsDraft && <div className="profile-settings-form"><label><span>화면 모드</span><CustomSelect ariaLabel="화면 모드" value={settingsDraft.theme} options={themeOptions} onChange={value => setSettingsDraft({ ...settingsDraft, theme: value as Theme })}/></label>{settingsMutation.isError && <p className="profile-form-error">{settingsMutation.error.message}</p>}</div>}</Modal>
    <Modal open={panel === 'learning'} title="학습 환경 설정" description="학습 목표와 테스트 구성을 선택하세요." onClose={() => setPanel(null)} footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setPanel(null)}>취소</button><button className="ui-dialog-primary" type="button" disabled={!settingsDraft || settingsMutation.isPending} onClick={() => settingsDraft && settingsMutation.mutate(settingsDraft)}>저장</button></>}>{settingsDraft && <div className="profile-settings-form"><label><span>주간 학습 목표</span><CustomSelect ariaLabel="주간 학습 목표" value={String(settingsDraft.weeklyGoalDays)} options={weeklyGoalOptions} onChange={value => setSettingsDraft({ ...settingsDraft, weeklyGoalDays: Number(value) })}/></label><fieldset className="profile-quiz-count"><legend>테스트 문제 수</legend><div>{quizQuestionCountPresets.map(count => <button type="button" key={count} className={settingsDraft.quizQuestionCount === count ? 'active' : ''} aria-pressed={settingsDraft.quizQuestionCount === count} onClick={() => setSettingsDraft({ ...settingsDraft, quizQuestionCount: count })}>{count}문제</button>)}</div><small>새로 시작하는 오늘의 테스트부터 적용됩니다.</small></fieldset>{settingsMutation.isError && <p className="profile-form-error">{settingsMutation.error.message}</p>}</div>}</Modal>
    <Modal open={panel === 'help'} title="도움말 및 지원" onClose={() => setPanel(null)} size="large"><div className="profile-help"><article><b>저장한 단어는 어디에서 복습하나요?</b><p>단어장 또는 마이페이지의 ‘복습하기’를 누르면 오늘의 테스트를 시작할 수 있어요.</p></article><article><b>숙련도는 어떻게 올라가나요?</b><p>복습 문제를 맞히면 0~7단계 안에서 한 단계씩 올라가며 다음 복습일이 자동으로 정해집니다.</p></article><section className="profile-inquiry"><h3>1:1 문의</h3><p>문의는 <b>jishuya3015@naver.com</b>으로 전달되며, 답변은 {user.email}로 보내드려요.</p><label><span>문의 유형</span><CustomSelect ariaLabel="문의 유형" value={inquiryCategory} options={inquiryOptions} onChange={setInquiryCategory}/></label><label><span>문의 내용</span><textarea value={inquiryMessage} onChange={event => setInquiryMessage(event.target.value)} minLength={10} maxLength={2000} placeholder="문의 내용을 10자 이상 입력해주세요."/></label><small>{inquiryMessage.length} / 2,000</small>{inquiryMutation.isError && <p className="profile-form-error">{inquiryMutation.error.message}</p>}<button className="ui-dialog-primary" type="button" disabled={inquiryMessage.trim().length < 10 || inquiryMutation.isPending} onClick={() => inquiryMutation.mutate()}>{inquiryMutation.isPending ? '전송 중...' : '문의 보내기'}</button></section></div></Modal>
    <Modal open={panel === 'account'} title="계정 관리" description="회원 탈퇴 시 모든 학습 기록이 영구적으로 삭제됩니다." tone="danger" onClose={() => setPanel(null)}><div className="profile-account-danger"><b>회원 탈퇴</b><p>단어장, 퀴즈 기록, XP, 생성한 스토리를 복구할 수 없습니다.</p><label className="profile-form-field"><span>확인을 위해 현재 비밀번호를 입력해주세요.</span><input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)}/></label>{deleteMutation.isError && <p className="profile-form-error">{deleteMutation.error.message}</p>}<button type="button" disabled={!deletePassword || deleteMutation.isPending} onClick={() => setDeleteConfirmOpen(true)}>회원 탈퇴</button></div></Modal>
    <ConfirmDialog open={deleteConfirmOpen} title="정말 탈퇴할까요?" message={<>계정과 모든 학습 데이터가 영구 삭제되며<br/>이 작업은 되돌릴 수 없습니다.</>} confirmLabel="영구 삭제" cancelLabel="취소" tone="danger" loading={deleteMutation.isPending} onCancel={() => setDeleteConfirmOpen(false)} onConfirm={() => deleteMutation.mutate()}/><ConfirmDialog open={logoutOpen} title="로그아웃할까요?" message="현재 기기에서 로그인 상태가 해제됩니다." confirmLabel="로그아웃" tone="danger" loading={logoutPending} onCancel={() => setLogoutOpen(false)} onConfirm={() => void confirmLogout()}/><AlertDialog open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message ?? ''} tone={alert?.tone ?? 'success'} onClose={() => setAlert(undefined)}/>
  </div>
}
