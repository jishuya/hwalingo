import type { ReactNode } from 'react'
import type { Page } from '../types/navigation'
import BottomNavigation from './navigation/BottomNavigation'
import TopNavigation from './navigation/TopNavigation'

export default function AppShell({ page, go, children }: { page: Page; go: (page: Page) => void; children: ReactNode }) {
  return <div className="app-shell">
    <TopNavigation currentPage={page} onNavigate={go}/>
    <main>{children}</main>
    <BottomNavigation currentPage={page} onNavigate={go}/>
  </div>
}
