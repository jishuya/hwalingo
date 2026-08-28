import { CaretDownIcon, CheckCircleIcon, LockSimpleIcon, StepsIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Modal } from '../ui/Dialog'
import LevelAvatar from './LevelAvatar'
import { AVAILABLE_AVATAR_LEVELS } from './levelAvatarAssets'

interface LevelAvatarGalleryProps { open: boolean; currentLevel: number; onClose: () => void }
interface EvolutionStage { id: number; name: string; description: string; start: number; end: number }

const stages: EvolutionStage[] = [
  { id: 1, name: 'Lv.1~10', description: '화랑이의 첫 번째 성장 모습', start: 1, end: 10 },
  { id: 2, name: 'Lv.11~20', description: '화랑이의 두 번째 성장 모습', start: 11, end: 20 },
  { id: 3, name: 'Lv.21~30', description: '화랑이의 세 번째 성장 모습', start: 21, end: 30 },
  { id: 4, name: 'Lv.31~40', description: '화랑이의 마지막 성장 모습', start: 31, end: 40 },
]

export default function LevelAvatarGallery({ open, currentLevel, onClose }: LevelAvatarGalleryProps) {
  const unlockedLevel = Math.min(AVAILABLE_AVATAR_LEVELS.length, Math.max(1, Math.floor(currentLevel)))
  const currentStage = Math.min(stages.length, Math.ceil(unlockedLevel / 10))
  const [expandedStages, setExpandedStages] = useState(() => new Set([currentStage]))
  const currentStageInfo = stages[currentStage - 1]
  const currentStageEnd = currentStageInfo.end
  const stageStart = (currentStage - 1) * 10 + 1
  const stageProgress = Math.min(100, ((unlockedLevel - stageStart + 1) / 10) * 100)

  const toggleStage = (stageId: number) => setExpandedStages(previous => {
    const next = new Set(previous)
    if (next.has(stageId)) next.delete(stageId)
    else next.add(stageId)
    return next
  })

  return <Modal open={open} title="화랑이 성장 도감" icon={<StepsIcon weight="duotone"/>} onClose={onClose} size="large">
    <section className="avatar-collection-summary">
      <div><span>현재 화랑이 레벨</span><strong>Lv.{unlockedLevel}</strong></div><b>{unlockedLevel} / 40 해금</b>
      <div className="avatar-evolution-progress"><i style={{ width: `${stageProgress}%` }}/></div>
      <small>{unlockedLevel < currentStageEnd ? `Lv.${currentStageEnd}까지 ${currentStageEnd - unlockedLevel}레벨` : currentStage === stages.length ? '모든 화랑이 레벨을 달성했어요!' : `Lv.${currentStageEnd} 달성! 다음 모습이 곧 시작돼요.`}</small>
    </section>
    <div className="avatar-evolution-list">
      {stages.map(stage => {
        const expanded = expandedStages.has(stage.id)
        const stageLevels = AVAILABLE_AVATAR_LEVELS.filter(level => level >= stage.start && level <= stage.end)
        const visibleLevels = expanded ? stageLevels : [stage.start, stage.start + 4, stage.end]
        const unlockedCount = Math.max(0, Math.min(10, unlockedLevel - stage.start + 1))
        return <section className={`avatar-evolution-stage${stage.id === currentStage ? ' active' : ''}`} key={stage.id}>
          <button className="avatar-stage-header" type="button" aria-expanded={expanded} onClick={() => toggleStage(stage.id)}>
            <span className="avatar-stage-number">{stage.id}</span><span><b>{stage.name}</b><small>{stage.description}</small></span><em>{unlockedCount} / 10</em><CaretDownIcon weight="bold"/>
          </button>
          <div className={`avatar-stage-levels${expanded ? ' expanded' : ' preview'}`}>
            {visibleLevels.map(level => {
              const unlocked = level <= unlockedLevel
              const current = level === unlockedLevel
              return <article className={`${unlocked ? 'unlocked' : 'locked'}${current ? ' current' : ''}`} key={level} aria-current={current ? 'true' : undefined} aria-label={`레벨 ${level} 캐릭터 · ${current ? '현재 사용 중' : unlocked ? '해금 완료' : '잠김'}`}>
                <div><LevelAvatar level={level}/>{current && <span className="avatar-current-badge">현재</span>}{!unlocked && <span className="avatar-lock"><LockSimpleIcon weight="fill"/></span>}{unlocked && !current && <CheckCircleIcon className="avatar-unlocked-check" weight="fill"/>}</div>
                <b>Lv.{level}</b><small>{current ? '현재' : unlocked ? '해금 완료' : `Lv.${level} 해금`}</small>
              </article>
            })}
          </div>
          {!expanded && <button className="avatar-stage-expand" type="button" onClick={() => toggleStage(stage.id)}>Lv.{stage.start}~{stage.end} 전체 보기</button>}
        </section>
      })}
    </div>
  </Modal>
}
