import { ImageIcon } from '@phosphor-icons/react'
import { Modal } from '../ui/Dialog'
import LevelAvatar from './LevelAvatar'
import { AVAILABLE_AVATAR_LEVELS } from './levelAvatarAssets'

interface LevelAvatarGalleryProps {
  open: boolean
  currentLevel: number
  onClose: () => void
}

export default function LevelAvatarGallery({ open, currentLevel, onClose }: LevelAvatarGalleryProps) {
  const displayedLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, currentLevel))

  return <Modal
    open={open}
    title="레벨 프로필 컬렉션"
    description="학습 레벨이 오를 때마다 새로운 프로필 캐릭터가 자동으로 적용돼요."
    icon={<ImageIcon weight="duotone"/>}
    onClose={onClose}
    size="large"
  >
    <div className="level-avatar-gallery">
      {AVAILABLE_AVATAR_LEVELS.map(level => <article className={level === displayedLevel ? 'current' : ''} key={level} aria-current={level === displayedLevel ? 'true' : undefined}>
        <div><LevelAvatar level={level}/></div>
        <b>Lv.{level}</b>
        {level === displayedLevel && <span>현재</span>}
      </article>)}
    </div>
  </Modal>
}
