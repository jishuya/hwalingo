import { ArrowRightIcon, SparkleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import AnalysisPage from '../../pages/AnalysisPage'
import { languageOptions } from '../../services/analysis'
import { Modal } from '../ui/Dialog'
import { analysisPreviewSamples } from './analysisPreviewSamples'
import './AnalysisPreview.css'

export default function AnalysisPreview({ onClose, onSignup }: { onClose: () => void; onSignup: () => void }) {
  const [selected, setSelected] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const sample = analysisPreviewSamples[selected]

  return (
    <Modal
      open
      title={showResults ? '예시 분석 결과' : '가입 없이 체험하기'}
      onClose={onClose}
      size="large"
      footer={showResults ? (
        <>
          <button className="ui-dialog-secondary" type="button" onClick={() => setShowResults(false)}>다른 예시 보기</button>
          <button className="ui-dialog-primary" type="button" onClick={onSignup}>내 문장 분석하기</button>
        </>
      ) : (
        <button className="ui-dialog-primary analysis-preview-continue" type="button" onClick={() => setShowResults(true)}>
          <SparkleIcon aria-hidden="true"/> 분석하기 <ArrowRightIcon aria-hidden="true"/>
        </button>
      )}
    >
      {showResults ? (
        <div className="analysis-preview-results" tabIndex={-1} ref={element => element?.focus()}>
          <AnalysisPage preview={sample} onSignup={onSignup}/>
        </div>
      ) : (
        <div className="analysis-preview">
          <div className="analysis-preview-languages" role="group" aria-label="예시 문장 언어">
            {analysisPreviewSamples.map((item, index) => (
              <button key={item.learningLanguage} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
                {languageOptions.find(option => option.code === item.learningLanguage)?.label} 예시
              </button>
            ))}
          </div>
          <article className="analysis-preview-sentence" lang={sample.learningLanguage} aria-live="polite">
            {sample.sentences.map(sentence => <p key={sentence.inputText}>{sentence.inputText}</p>)}
          </article>
        </div>
      )}
    </Modal>
  )
}
