import { useEffect, useState } from 'react'
import AppShell from './components/AppShell'
import AnalysisPage from './pages/AnalysisPage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import QuizPage from './pages/QuizPage'
import StoryPage from './pages/StoryPage'
import StudyPage from './pages/StudyPage'
import VocabularyPage from './pages/VocabularyPage'
import { readRoute, type Page } from './types/navigation'
import './App.css'

export default function App() {
  const [page, setPage] = useState<Page>(readRoute)

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

  if (page === 'login') return <LoginPage done={() => go('study')}/>

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
          : <ProfilePage logout={() => go('login')}/>

  return <AppShell page={page} go={go}>{content}</AppShell>
}
