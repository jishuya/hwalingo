import { FireIcon } from '@phosphor-icons/react/dist/csr/Fire'
import { useQuery } from '@tanstack/react-query'
import { getUserProgress } from '../../services/progress'
import logo from '../../assets/hwalingo_logo.png'
import wordmark from '../../assets/wordmarks/hwalingo-wordmark-01-rounded.png'
import type { Page } from '../../types/navigation'
import { navigationItems } from './navigationItems'

interface TopNavigationProps {
  showStreak?: boolean
  currentPage: Page
  onNavigate: (page: Page) => void
  onHome: () => void
}

export default function TopNavigation({ currentPage, onNavigate, onHome, showStreak = true }: TopNavigationProps) {
  const progressQuery = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress, enabled: showStreak })
  const streak = progressQuery.data?.currentStreak

  return <header className="topbar">
    <button type="button" className="brand" onClick={onHome} aria-label="HwaLingo 홈으로 이동">
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
    {showStreak && <div className="learning-streak" aria-label={streak === undefined ? (progressQuery.isPending ? '연속 학습 일수를 불러오는 중' : '연속 학습 일수를 불러오지 못했습니다') : `연속 학습 ${streak}일`} title="연속 학습">
      <FireIcon size={22} weight="fill" aria-hidden="true"/>
      <span>{streak ?? '–'}일 연속</span>
    </div>}
  </header>
}
