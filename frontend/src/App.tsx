import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
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
    ? <StudyPage/>
      : page === 'vocabulary'
        ? <VocabularyPage/>
        : page === 'quiz'
          ? <QuizPage/>
        : page === 'story'
          ? <StoryPage/>
          : <ProfilePage user={authQuery.data.user} logout={finishLogout} onNavigate={go}/>

  return <AppShell page={page} go={go}>{content}</AppShell>
}
