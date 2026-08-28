const avatarModules = import.meta.glob('../../assets/level-avatars/lv-*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export const AVAILABLE_AVATAR_LEVELS = Array.from({ length: 50 }, (_, index) => index + 1)

export function levelAvatarSrc(level: number): string {
  const safeLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, Math.floor(level)))
  const fileName = `lv-${String(safeLevel).padStart(2, '0')}.png`
  const entry = Object.entries(avatarModules).find(([path]) => path.endsWith(fileName))

  if (!entry) throw new Error(`${fileName} 레벨 아바타를 찾을 수 없습니다.`)
  return entry[1]
}
