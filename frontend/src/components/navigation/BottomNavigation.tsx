import type { Page } from '../../types/navigation'
import { navigationItems } from './navigationItems'

export default function BottomNavigation({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) {
  return <nav className="bottom-nav" aria-label="모바일 주요 메뉴">
    {navigationItems.map(item => {
      const NavigationIcon = item.icon
      const active = currentPage === item.id
      return <button key={item.id} className={active ? 'active' : ''} onClick={() => onNavigate(item.id)} aria-current={active ? 'page' : undefined}>
        <NavigationIcon className="nav-icon" size={22} weight={active ? 'fill' : 'regular'} aria-hidden="true"/><span>{item.label}</span>
      </button>
    })}
  </nav>
}
