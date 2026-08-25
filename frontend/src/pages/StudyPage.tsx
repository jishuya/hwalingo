import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, ArrowRightIcon, CheckIcon } from '@phosphor-icons/react'
import Icon from '../components/Icon'
import { languageOptions, type AnalysisRequest, type LanguageCode } from '../services/analysis'

function LanguageSelect({ value, onChange, ariaLabel }: { value: LanguageCode; onChange: (value: LanguageCode) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLanguage = languageOptions.find(language => language.code === value) ?? languageOptions[0]

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  return <div className={`language-select${open ? ' open' : ''}`} ref={rootRef}><button type="button" className="language-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{selectedLanguage.label}</span><CaretDownIcon aria-hidden="true" weight="bold" /></button>{open && <div className="language-menu" role="listbox" aria-label={ariaLabel}>{languageOptions.map(language => <button type="button" role="option" aria-selected={value === language.code} className={value === language.code ? 'selected' : ''} key={language.code} onClick={() => { onChange(language.code); setOpen(false) }}><span>{language.label}</span>{value === language.code && <CheckIcon aria-hidden="true" weight="bold" />}</button>)}</div>}</div>
}

export default function StudyPage({ analyze }: { analyze: (request: AnalysisRequest) => void }) {
  const [text, setText] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('ko')
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('en')
  const submit = () => {
    const sentence = text.trim()
    if (sentence && sourceLanguage !== targetLanguage) analyze({ text: sentence, sourceLanguage, targetLanguage })
  }

  return <div className="page narrow"><section className="card input-card"><div className="study-heading"><h1>학습할 언어와 문구를 입력하세요</h1><div className="language-selectors"><LanguageSelect value={sourceLanguage} onChange={setSourceLanguage} ariaLabel="원문 언어"/><span className="language-arrow" aria-hidden="true"><ArrowRightIcon weight="bold" /></span><LanguageSelect value={targetLanguage} onChange={setTargetLanguage} ariaLabel="학습할 언어"/></div></div><textarea value={text} maxLength={500} onChange={event => setText(event.target.value)} placeholder="학습하고 싶은 문장이나 문구를 입력해 주세요."/>{sourceLanguage === targetLanguage && <p className="form-error" role="alert">서로 다른 언어를 선택해 주세요.</p>}<div className="input-footer"><span>{text.length} / 500</span><button className="primary" disabled={!text.trim() || sourceLanguage === targetLanguage} onClick={submit}><Icon>✦</Icon> AI 분석 시작</button></div></section><div className="empty-state"><span>✎</span><p>AI가 표현과 핵심 어휘를 분석해 드려요.</p></div></div>
}
