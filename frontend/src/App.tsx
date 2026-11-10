import { lazy, Suspense, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import LoginRequired from './components/ui/LoginRequired'
import { SESSION_EXPIRED_EVENT } from './services/apiFetch'
import { RobotIcon, StarIcon, ExamIcon, SparkleIcon, UserCircleIcon, ChartBarIcon } from '@phosphor-icons/react'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import StudyPage from './pages/StudyPage'
import { getCurrentUser, logout, type AuthUser } from './services/auth'
import { getUserSettings } from './services/settings'
import { readRoute, type Page } from './types/navigation'
import './App.css'

const LearningProgressPage = lazy(() => import('./pages/LearningProgressPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const StoryPage = lazy(() => import('./pages/StoryPage'))
const VocabularyPage = lazy(() => import('./pages/VocabularyPage'))

export default function App() {
  const [sessionExpired, setSessionExpired] = useState(false)
  const [page, setPage] = useState<Page>(readRoute)
  const [studyPageKey, setStudyPageKey] = useState(0)
  const [quizMode, setQuizMode] = useState<'standard' | 'incorrect'>(() => new URLSearchParams(location.search).get('mode') === 'incorrect' ? 'incorrect' : 'standard')
  const [practiceIds,setPracticeIds] = useState<string[]|undefined>(()=>new URLSearchParams(location.search).get('words')?.split(',').filter(Boolean))
  const queryClient = useQueryClient()
  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
    refetchOnWindowFocus: true,
  })
  useEffect(() => {
    const expireSession = () => setSessionExpired(true)
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession)
  }, [])
  useEffect(() => {
    if (page !== 'login' && !sessionExpired) void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }, [page, sessionExpired, queryClient])
  const settingsQuery = useQuery({ queryKey: ['settings', 'me'], queryFn: getUserSettings, enabled: Boolean(authQuery.data) && !sessionExpired })

  useEffect(() => {
    const theme = settingsQuery.data?.theme
    if (!theme) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme }
    applyTheme()
    if (theme === 'system') media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [settingsQuery.data?.theme])

  useEffect(() => {
    const syncRoute = () => { setPracticeIds(new URLSearchParams(location.search).get('words')?.split(',').filter(Boolean)); setPage(readRoute()); setQuizMode(new URLSearchParams(location.search).get('mode') === 'incorrect' ? 'incorrect' : 'standard') }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const go = (nextPage: Page) => {
    setQuizMode('standard')
    setPracticeIds(undefined)
    history.pushState(null, '', `/${nextPage}`)
    setPage(nextPage)
    window.scrollTo(0, 0)
  }

  const startIncorrectTest = (vocabularyIds?:string[]) => {
    queryClient.removeQueries({ queryKey: ['quiz'] })
    history.pushState(null, '', '/quiz?mode=incorrect'+(vocabularyIds?.length?'&words='+encodeURIComponent(vocabularyIds.join(',')):''))
    setPracticeIds(vocabularyIds)
    setQuizMode('incorrect')
    setPage('quiz')
    window.scrollTo(0, 0)
  }

  const goHome = () => {
    setStudyPageKey(current => current + 1)
    go('study')
  }

  const finishAuth = (user: AuthUser) => {
    queryClient.clear()
    setSessionExpired(false)
    queryClient.setQueryData(['auth', 'me'], { user })
    go('study')
  }

  const finishLogout = async () => {
    await logout()
    queryClient.setQueryData(['auth', 'me'], undefined)
    go('login')
  }

  if (authQuery.isPending) return <div className="auth-loading">Hwalingo 불러오는 중...</div>
  if (page === 'login' || (!authQuery.data && !sessionExpired)) return <LoginPage done={finishAuth}/>

  if (sessionExpired) {
    const titles = {
      study: { title: 'AI 문장 분석', Icon: RobotIcon },
      vocabulary: { title: '내 단어장', Icon: StarIcon },
      quiz: { title: '테스트', Icon: ExamIcon },
      story: { title: '스토리텔링', Icon: SparkleIcon },
      profile: { title: '마이페이지', Icon: UserCircleIcon },
      'learning-progress': { title: '학습 리포트', Icon: ChartBarIcon },
    }
    const { title, Icon } = titles[page]
    return <AppShell page={page} go={go} onHome={goHome} sessionExpired><div className="page session-expired-page">
      <header className="page-title"><span className="page-title-icon"><Icon weight="duotone" aria-hidden="true"/></span><h1>{title}</h1></header>
      <LoginRequired/>
    </div></AppShell>
  }

  const content = page === 'study'
    ? <StudyPage key={studyPageKey}/>
      : page === 'vocabulary'
        ? <VocabularyPage onIncorrectTest={startIncorrectTest}/>
        : page === 'quiz'
          ? <QuizPage key={`${quizMode}:${practiceIds?.join(',')??'all'}`} mode={quizMode} vocabularyIds={practiceIds} onHome={() => go(quizMode === 'incorrect' ? 'vocabulary' : 'study')}/>
        : page === 'story'
          ? <StoryPage onVocabulary={() => go('vocabulary')}/>
          : page === 'learning-progress'
            ? <LearningProgressPage onNavigate={go} onIncorrectTest={()=>startIncorrectTest()}/>
          : <ProfilePage user={authQuery.data!.user} logout={finishLogout} onNavigate={go}/>

  return <AppShell page={page} go={go} onHome={goHome}><Suspense fallback={<div className="page" role="status">화면을 불러오는 중이에요.</div>}>{content}</Suspense></AppShell>
}
