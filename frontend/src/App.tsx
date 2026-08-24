import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppShell from './components/AppShell'
import AnalysisPage from './pages/AnalysisPage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import QuizPage from './pages/QuizPage'
import StoryPage from './pages/StoryPage'
import StudyPage from './pages/StudyPage'
import VocabularyPage from './pages/VocabularyPage'
import { getCurrentUser, logout, type AuthUser } from './services/auth'
import { readRoute, type Page } from './types/navigation'
import './App.css'

export default function App() {
  const [page, setPage] = useState<Page>(readRoute)
  const queryClient = useQueryClient()
  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  })

  useEffect(() => {
    const syncRoute = () => setPage(readRoute())
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const go = (nextPage: Page) => {
    history.pushState(null, '', `/${nextPage}`)
    setPage(nextPage)
    window.scrollTo(0, 0)
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
    ? <StudyPage analyze={() => go('analysis')}/>
    : page === 'analysis'
      ? <AnalysisPage/>
      : page === 'vocabulary'
        ? <VocabularyPage/>
        : page === 'quiz'
          ? <QuizPage/>
        : page === 'story'
          ? <StoryPage/>
          : <ProfilePage user={authQuery.data.user} logout={finishLogout}/>

  return <AppShell page={page} go={go}>{content}</AppShell>
}
