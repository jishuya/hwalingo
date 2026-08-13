import type { ReactNode } from 'react'
import type { Page } from '../types/navigation'
import Icon from './Icon'

const nav: { id: Page; icon: string; label: string }[] = [
  { id: 'study', icon: '▤', label: '문장분석' },
  { id: 'vocabulary', icon: '◆', label: '단어장' },
  { id: 'analysis', icon: '✓', label: '테스트' },
  { id: 'story', icon: '✦', label: '스토리텔링' },
  { id: 'profile', icon: '●', label: '마이페이지' },
]

export default function AppShell({ page, go, children }: { page: Page; go: (page: Page) => void; children: ReactNode }) {
  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => go('study')}><span>◎</span> HwaLingo</button><nav className="desktop-nav">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon>{item.icon}</Icon>{item.label}</button>)}</nav></header>
    <main>{children}</main>
    <nav className="bottom-nav">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon>{item.icon}</Icon><span>{item.label}</span></button>)}</nav>
  </div>
}
