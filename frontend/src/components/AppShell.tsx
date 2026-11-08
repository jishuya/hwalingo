import type { ReactNode } from 'react'
import type { Page } from '../types/navigation'
import BottomNavigation from './navigation/BottomNavigation'
import TopNavigation from './navigation/TopNavigation'

export default function AppShell({ page, go, onHome, children, sessionExpired = false }: { page: Page; go: (page: Page) => void; onHome: () => void; children: ReactNode; sessionExpired?: boolean }) {
  return <div className="app-shell">
    <TopNavigation showStreak={!sessionExpired} currentPage={page === 'learning-progress' ? 'profile' : page} onNavigate={go} onHome={onHome}/>
    <main>{children}</main>
    <BottomNavigation currentPage={page === 'learning-progress' ? 'profile' : page} onNavigate={go}/>
  </div>
}
