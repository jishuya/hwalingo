import { SparkleIcon } from '@phosphor-icons/react'
import { Modal } from './Dialog'
import '../../pages/AnalysisLoading.css'

export default function AiLoadingOverlay({ open, kind }: { open: boolean; kind: 'analysis' | 'story' }) {
  const isStory = kind === 'story'
  return <Modal open={open} title={isStory ? 'AI 스토리 생성 중' : 'AI 문장 분석 중'} hideHeader onClose={() => {}} closeOnBackdrop={false} hideClose size="small" presentation="compact">
    <div className="analysis-loading analysis-loading-progress" role="status" aria-label={isStory ? 'AI 스토리 생성 중' : 'AI 분석 중'}>
      <div className="analysis-loading-art" aria-hidden="true"><div className="analysis-loading-tile"><SparkleIcon weight="fill"/></div><SparkleIcon className="analysis-loading-star star-one" weight="fill"/><SparkleIcon className="analysis-loading-star star-two" weight="fill"/><span className="analysis-loading-dot"/></div>
      <strong>{isStory ? 'AI가 이야기를 만들고 있어요' : 'AI가 분석 중이에요'}</strong>
      <span>{isStory ? '스토리 길이에 따라 시간이 조금 걸릴 수 있어요.' : '문장 길이에 따라 시간이 조금 걸릴 수 있어요.'}</span>
      <div className="analysis-progress-track" role="progressbar" aria-label={isStory ? '스토리 생성 진행 중' : '문장 분석 진행 중'}><i /></div>
    </div>
  </Modal>
}
