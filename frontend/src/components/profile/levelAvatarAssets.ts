const avatarModules = import.meta.glob('../../assets/level-avatars/lv-*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const thumbnailModules = import.meta.glob('../../assets/level-avatar-thumbnails/lv-*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export const AVAILABLE_AVATAR_LEVELS = Array.from({ length: 50 }, (_, index) => index + 1)

function avatarAsset(modules: Record<string, string>, level: number): string {
  const safeLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, Math.floor(level)))
  const fileName = `lv-${String(safeLevel).padStart(2, '0')}.webp`
  const entry = Object.entries(modules).find(([path]) => path.endsWith(fileName))

  if (!entry) throw new Error(`${fileName} 레벨 아바타를 찾을 수 없습니다.`)
  return entry[1]
}

export function levelAvatarSources(level: number): { src: string; srcSet: string } {
  const thumbnail = avatarAsset(thumbnailModules, level)
  const full = avatarAsset(avatarModules, level)
  return { src: full, srcSet: `${thumbnail} 192w, ${full} 384w` }
}
