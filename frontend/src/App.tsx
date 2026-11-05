import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import LearningProgressPage from './pages/LearningProgressPage'
import ProfilePage from './pages/ProfilePage'
import QuizPage from './pages/QuizPage'
import StoryPage from './pages/StoryPage'
import StudyPage from './pages/StudyPage'
import VocabularyPage from './pages/VocabularyPage'
import { getCurrentUser, logout, type AuthUser } from './services/auth'
import { getUserSettings } from './services/settings'
import { readRoute, type Page } from './types/navigation'
import './App.css'

export default function App() {
  const [page, setPage] = useState<Page>(readRoute)
  const [studyPageKey, setStudyPageKey] = useState(0)
  const [quizMode, setQuizMode] = useState<'standard' | 'incorrect'>(() => new URLSearchParams(location.search).get('mode') === 'incorrect' ? 'incorrect' : 'standard')
  const [practiceIds,setPracticeIds] = useState<string[]|undefined>(()=>new URLSearchParams(location.search).get('words')?.split(',').filter(Boolean))
  const queryClient = useQueryClient()
  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  })
  const settingsQuery = useQuery({ queryKey: ['settings', 'me'], queryFn: getUserSettings, enabled: Boolean(authQuery.data) })

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
    queryClient.setQueryData(['auth', 'me'], { user })
    go('study')
  }

  const finishLogout = async () => {
    await logout()
    queryClient.setQueryData(['auth', 'me'], undefined)
    go('login')
  }

  if (authQuery.isPending) return <div className="auth-loading">Hwalingo 불러오는 중...</div>
  if (!authQuery.data || page === 'login') return <LoginPage done={finishAuth}/>

  const content = page === 'study'
    ? <StudyPage key={studyPageKey}/>
      : page === 'vocabulary'
        ? <VocabularyPage onIncorrectTest={startIncorrectTest}/>
        : page === 'quiz'
          ? <QuizPage key={`${quizMode}:${practiceIds?.join(',')??'all'}`} mode={quizMode} vocabularyIds={practiceIds} onHome={() => go(quizMode === 'incorrect' ? 'vocabulary' : 'study')}/>
        : page === 'story'
          ? <StoryPage/>
          : page === 'learning-progress'
            ? <LearningProgressPage onNavigate={go} onIncorrectTest={()=>startIncorrectTest()}/>
          : <ProfilePage user={authQuery.data.user} logout={finishLogout} onNavigate={go}/>

  return <AppShell page={page} go={go} onHome={goHome}>{content}</AppShell>
}
