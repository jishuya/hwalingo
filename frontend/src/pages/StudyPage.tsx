import { useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, CaretDownIcon, ArrowRightIcon, CheckIcon, SparkleIcon } from '@phosphor-icons/react'
import PhotoTextInput from '../components/study/PhotoTextInput'
import { AlertDialog, ConfirmDialog } from '../components/ui/Dialog'
import { languageOptions, type AnalysisRequest, type LanguageCode } from '../services/analysis'
import { getLanguageDetection } from '../utils/detectLanguage'
import AnalysisPage from './AnalysisPage'

type InputLanguageSelection = LanguageCode | 'auto'
type LanguageOption = { code: InputLanguageSelection; label: string }

function LanguageSelect({ value, onChange, ariaLabel, options = languageOptions, displayLabel }: { value: InputLanguageSelection; onChange: (value: InputLanguageSelection) => void; ariaLabel: string; options?: readonly LanguageOption[]; displayLabel?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLanguage = options.find(language => language.code === value) ?? options[0]

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  return <div className={`language-select${open ? ' open' : ''}`} ref={rootRef}><button type="button" className="language-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{displayLabel ?? selectedLanguage.label}</span><CaretDownIcon aria-hidden="true" weight="bold" /></button>{open && <div className="language-menu" role="listbox" aria-label={ariaLabel}>{options.map(language => <button type="button" role="option" aria-selected={value === language.code} className={value === language.code ? 'selected' : ''} key={language.code} onClick={() => { onChange(language.code); setOpen(false) }}><span>{language.label}</span>{value === language.code && <CheckIcon aria-hidden="true" weight="bold" />}</button>)}</div>}</div>
}

export default function StudyPage() {
  const [text, setText] = useState('')
  const [inputLanguage, setInputLanguage] = useState<InputLanguageSelection>('auto')
  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>('en')
  const [activeRequest, setActiveRequest] = useState<AnalysisRequest>()
  const [requestId, setRequestId] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [detectionNoticeOpen, setDetectionNoticeOpen] = useState(false)
  const [languageMismatch, setLanguageMismatch] = useState<{ sentence: string; detectedLanguage: LanguageCode }>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const detection = getLanguageDetection(text)
  const detectedLanguage = detection.language
  const resolvedInputLanguage = inputLanguage === 'auto' ? detectedLanguage : inputLanguage
  const detectedLanguageLabel = languageOptions.find(language => language.code === detectedLanguage)?.label
  const selectedLanguageLabel = languageOptions.find(language => language.code === inputLanguage)?.label
  const inputLanguageOptions = [{ code: 'auto', label: '자동 감지' }, ...languageOptions] as const
  const runAnalysis = (sentence: string, language: LanguageCode) => {
    setActiveRequest({ text: sentence, inputLanguage: language, learningLanguage })
    setRequestId(current => current + 1)
  }
  const submit = () => {
    const sentence = text.trim()
    if (!sentence || isAnalyzing) return
    if (inputLanguage === 'auto' && !resolvedInputLanguage) {
      setDetectionNoticeOpen(true)
      return
    }
    if (inputLanguage !== 'auto' && detectedLanguage && detectedLanguage !== inputLanguage) {
      setLanguageMismatch({ sentence, detectedLanguage })
      return
    }
    if (resolvedInputLanguage) runAnalysis(sentence, resolvedInputLanguage)
  }
  const clearText = () => {
    setText('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }
  const autoDisplayLabel = detection.status === 'mixed' ? '혼합 언어' : detection.status === 'low-confidence' && text.trim() ? '언어 선택 필요' : detectedLanguageLabel
  const mismatchDetectedLabel = languageOptions.find(language => language.code === languageMismatch?.detectedLanguage)?.label ?? ''

  return <><div className="page study-page">
    {!activeRequest && <section className="story-intro" aria-labelledby="study-intro-title">
      <div className="story-intro-copy">
        <span className="story-intro-badge"><SparkleIcon weight="fill"/> 궁금한 문장을 나만의 배움으로</span>
        <h1 id="study-intro-title">AI 문장 분석 <span aria-hidden="true">✨</span></h1>
        <p>어려운 뉴스도, 미드 속 대사도 쉽게 이해하고 배워보세요.</p>
        <ul className="study-intro-features" aria-label="주요 분석 기능">
          <li>직독직해 구문분해</li>
          <li>CEFR B1~C2 패러프레이징</li>
        </ul>
      </div>
    </section>}
    <section className="card input-card study-composer study-composer-v2">
      <PhotoTextInput hasText={Boolean(text.trim())} disabled={isAnalyzing} characterCount={text.length} onApply={value => { setText(value); requestAnimationFrame(() => textareaRef.current?.focus()) }} controls={<div className="study-composer-settings"><div className="language-selectors"><div className="language-field"><span className="language-field-label">입력언어</span><LanguageSelect value={inputLanguage} onChange={setInputLanguage} ariaLabel="입력언어" options={inputLanguageOptions} displayLabel={inputLanguage === 'auto' ? autoDisplayLabel : undefined}/></div><span className="language-arrow" aria-hidden="true"><ArrowRightIcon weight="bold" /></span><div className="language-field"><span className="language-field-label">학습언어</span><LanguageSelect value={learningLanguage} onChange={value => setLearningLanguage(value as LanguageCode)} ariaLabel="학습언어"/></div></div></div>}>
        <div className="study-text-field"><textarea aria-label="학습할 내용" id="study-text" ref={textareaRef} value={text} maxLength={500} onChange={event => setText(event.target.value)} placeholder="학습하고 싶은 문장이나 문구를 입력해 주세요."/>
        {text.length > 0 && <button type="button" className="study-clear-text" aria-label="입력 내용 초기화" title="입력 내용 초기화" onClick={clearText}><ArrowClockwiseIcon weight="bold" aria-hidden="true"/></button>}</div>
      </PhotoTextInput>

      <div className="input-footer study-composer-submit"><button type="button" className="primary" disabled={isAnalyzing || !text.trim()} onClick={submit} aria-busy={isAnalyzing}><SparkleIcon size={16} weight="fill" aria-hidden="true"/> {isAnalyzing ? 'AI 분석 중...' : 'AI 분석 시작'}</button></div>
    </section>{activeRequest && <AnalysisPage request={activeRequest} requestId={requestId} onLoadingChange={setIsAnalyzing}/>}</div><AlertDialog open={detectionNoticeOpen} title="입력언어를 선택해 주세요" message="여러 언어가 섞여 있거나 문장이 짧아 입력언어를 확실하게 감지하지 못했어요." tone="warning" onClose={() => setDetectionNoticeOpen(false)}/><ConfirmDialog open={Boolean(languageMismatch)} title="입력언어가 다른 것 같아요" message={`선택한 언어는 ${selectedLanguageLabel ?? ''}이지만 ${mismatchDetectedLabel}(으)로 감지되었습니다.`} confirmLabel={`${mismatchDetectedLabel}로 변경`} cancelLabel={`${selectedLanguageLabel ?? '선택한 언어'}로 계속`} onCancel={() => { if (languageMismatch && inputLanguage !== 'auto') runAnalysis(languageMismatch.sentence, inputLanguage); setLanguageMismatch(undefined) }} onConfirm={() => { if (languageMismatch) { setInputLanguage(languageMismatch.detectedLanguage); runAnalysis(languageMismatch.sentence, languageMismatch.detectedLanguage) } setLanguageMismatch(undefined) }}/></>
}
