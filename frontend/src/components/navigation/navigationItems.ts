import type { Icon } from '@phosphor-icons/react'
import { BookOpenIcon } from '@phosphor-icons/react/dist/csr/BookOpen'
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple'
import { ExamIcon } from '@phosphor-icons/react/dist/csr/Exam'
import { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle'
import { UserCircleIcon } from '@phosphor-icons/react/dist/csr/UserCircle'
import type { Page } from '../../types/navigation'

export const navigationItems: { id: Page; icon: Icon; label: string }[] = [
  { id: 'study', icon: BookOpenIcon, label: '문장분석' },
  { id: 'vocabulary', icon: BookmarkSimpleIcon, label: '단어장' },
  { id: 'quiz', icon: ExamIcon, label: '테스트' },
  { id: 'story', icon: SparkleIcon, label: '스토리텔링' },
  { id: 'profile', icon: UserCircleIcon, label: '마이페이지' },
]
