import logo from '../../assets/hwalingo_logo.png'
import type { Page } from '../../types/navigation'
import { navigationItems } from './navigationItems'

interface TopNavigationProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export default function TopNavigation({ currentPage, onNavigate }: TopNavigationProps) {
  return <header className="topbar">
    <button className="brand" onClick={() => onNavigate('study')} aria-label="HwaLingo 홈으로 이동">
      <img src={logo} alt=""/>
      <span>HwaLingo</span>
    </button>
    <nav className="desktop-nav" aria-label="주요 메뉴">
      {navigationItems.map(item => {
        const NavigationIcon = item.icon
        const active = currentPage === item.id
        return <button key={item.id} className={active ? 'active' : ''} onClick={() => onNavigate(item.id)} aria-current={active ? 'page' : undefined}>
          <NavigationIcon size={19} weight={active ? 'fill' : 'regular'} aria-hidden="true"/>{item.label}
        </button>
      })}
    </nav>
  </header>
}
