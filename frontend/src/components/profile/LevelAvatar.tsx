import { AVAILABLE_AVATAR_LEVELS, levelAvatarSrc } from './levelAvatarAssets'

interface LevelAvatarProps {
  level: number
  className?: string
  eager?: boolean
}

export default function LevelAvatar({ level, className = '', eager = false }: LevelAvatarProps) {
  const displayedLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, Math.floor(level)))

  return <img
    className={className}
    src={levelAvatarSrc(displayedLevel)}
    alt={`레벨 ${displayedLevel} 프로필 캐릭터`}
    loading={eager ? 'eager' : 'lazy'}
  />
}
