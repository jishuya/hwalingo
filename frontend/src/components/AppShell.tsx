import type { ReactNode } from 'react'
import type { Page } from '../types/navigation'
import BottomNavigation from './navigation/BottomNavigation'
import TopNavigation from './navigation/TopNavigation'

export default function AppShell({ page, go, onHome, children }: { page: Page; go: (page: Page) => void; onHome: () => void; children: ReactNode }) {
  return <div className="app-shell">
    <TopNavigation currentPage={page === 'learning-progress' ? 'profile' : page} onNavigate={go} onHome={onHome}/>
    <main>{children}</main>
    <BottomNavigation currentPage={page === 'learning-progress' ? 'profile' : page} onNavigate={go}/>
  </div>
}
