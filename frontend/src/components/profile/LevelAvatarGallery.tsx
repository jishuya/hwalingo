import { CaretDownIcon, CheckCircleIcon, LockSimpleIcon, StepsIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Modal } from '../ui/Dialog'
import { HWARANG_GRADES, hwarangGradeForLevel } from './hwarangGrades'
import LevelAvatar from './LevelAvatar'
import { AVAILABLE_AVATAR_LEVELS } from './levelAvatarAssets'

interface LevelAvatarGalleryProps { open: boolean; currentLevel: number; onClose: () => void }

export default function LevelAvatarGallery({ open, currentLevel, onClose }: LevelAvatarGalleryProps) {
  const unlockedLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, Math.floor(currentLevel)))
  const currentGrade = hwarangGradeForLevel(unlockedLevel)
  const currentStage = currentGrade.index + 1
  const [expandedStages, setExpandedStages] = useState(() => new Set([currentStage]))

  const toggleStage = (stageId: number) => setExpandedStages(previous => {
    const next = new Set(previous)
    if (next.has(stageId)) next.delete(stageId)
    else next.add(stageId)
    return next
  })

  return <Modal open={open} title="화랑이 성장 도감" icon={<StepsIcon weight="duotone"/>} onClose={onClose} size="large">
    <section className="avatar-collection-summary">
      <div><span>현재 화랑이 등급</span><strong>{currentGrade.name} · {currentGrade.step}단계</strong></div><b>{unlockedLevel} / 50 해금</b>
      <div className="avatar-evolution-progress"><i style={{ width: `${currentGrade.step * 10}%` }}/></div>
      <small>{currentGrade.step < 10 ? `${currentGrade.name} 완성까지 ${10 - currentGrade.step}단계` : currentGrade.index === HWARANG_GRADES.length - 1 ? '모든 화랑이 등급을 달성했어요!' : `${currentGrade.name} 완성! 다음 등급이 곧 시작돼요.`}</small>
    </section>
    <div className="avatar-evolution-list">
      {HWARANG_GRADES.map((grade, index) => {
        const stageId = index + 1
        const expanded = expandedStages.has(stageId)
        const gradeLevels = AVAILABLE_AVATAR_LEVELS.filter(level => level >= grade.start && level <= grade.end)
        const visibleLevels = expanded ? gradeLevels : [grade.start, grade.start + 4, grade.end]
        const unlockedCount = Math.max(0, Math.min(10, unlockedLevel - grade.start + 1))
        return <section className={`avatar-evolution-stage${stageId === currentStage ? ' active' : ''}`} key={grade.name}>
          <button className="avatar-stage-header" type="button" aria-expanded={expanded} onClick={() => toggleStage(stageId)}>
            <span className="avatar-stage-number">{stageId}</span><span><b>{grade.name}</b><small>{grade.description}</small></span><em>{unlockedCount} / 10</em><CaretDownIcon weight="bold"/>
          </button>
          <div className={`avatar-stage-levels${expanded ? ' expanded' : ' preview'}`}>
            {visibleLevels.map(level => {
              const unlocked = level <= unlockedLevel
              const current = level === unlockedLevel
              const gradeStep = level - grade.start + 1
              return <article className={`${unlocked ? 'unlocked' : 'locked'}${current ? ' current' : ''}`} key={level} aria-current={current ? 'true' : undefined} aria-label={`${grade.name} ${gradeStep}단계 캐릭터 · ${current ? '현재 사용 중' : unlocked ? '해금 완료' : '잠김'}`}>
                <div><LevelAvatar level={level}/>{current && <span className="avatar-current-badge">현재</span>}{!unlocked && <span className="avatar-lock"><LockSimpleIcon weight="fill"/></span>}{unlocked && !current && <CheckCircleIcon className="avatar-unlocked-check" weight="fill"/>}</div>
                <b>{gradeStep}단계</b><small>{current ? '현재' : unlocked ? '해금 완료' : '잠김'}</small>
              </article>
            })}
          </div>
          {!expanded && <button className="avatar-stage-expand" type="button" onClick={() => toggleStage(stageId)}>{grade.name} 전체 보기</button>}
        </section>
      })}
    </div>
  </Modal>
}
