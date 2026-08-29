import { AVAILABLE_AVATAR_LEVELS, levelAvatarSources } from './levelAvatarAssets'

interface LevelAvatarProps {
  level: number
  className?: string
  eager?: boolean
  sizes?: string
}

export default function LevelAvatar({ level, className = '', eager = false, sizes = '(max-width: 600px) 30vw, 110px' }: LevelAvatarProps) {
  const displayedLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, Math.floor(level)))
  const sources = levelAvatarSources(displayedLevel)

  return <img
    className={className}
    src={sources.src}
    srcSet={sources.srcSet}
    sizes={sizes}
    width="384"
    height="384"
    alt={`레벨 ${displayedLevel} 프로필 캐릭터`}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    fetchPriority={eager ? 'high' : 'auto'}
  />
}
