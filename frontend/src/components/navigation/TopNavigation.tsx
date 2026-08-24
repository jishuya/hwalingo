import { BellIcon } from '@phosphor-icons/react/dist/csr/Bell'
import logo from '../../assets/hwalingo_logo.png'
import wordmark from '../../assets/wordmarks/hwalingo-wordmark-01-rounded.png'
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
      <img className="brand-wordmark" src={wordmark} alt="Hwalingo"/>
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
    <button className="notification-button" type="button" aria-label="알림 열기">
      <BellIcon size={23} weight="regular" aria-hidden="true"/>
    </button>
  </header>
}
