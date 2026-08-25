import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, ArrowRightIcon, CheckIcon } from '@phosphor-icons/react'
import Icon from '../components/Icon'

const languages = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh', label: '중국어' },
  { value: 'fr', label: '프랑스어' },
]

function LanguageSelect({ defaultValue, ariaLabel }: { defaultValue: string; ariaLabel: string }) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLanguage = languages.find(language => language.value === value) ?? languages[0]

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  return <div className={`language-select${open ? ' open' : ''}`} ref={rootRef}><button type="button" className="language-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{selectedLanguage.label}</span><CaretDownIcon aria-hidden="true" weight="bold" /></button>{open && <div className="language-menu" role="listbox" aria-label={ariaLabel}>{languages.map(language => <button type="button" role="option" aria-selected={value === language.value} className={value === language.value ? 'selected' : ''} key={language.value} onClick={() => { setValue(language.value); setOpen(false) }}><span>{language.label}</span>{value === language.value && <CheckIcon aria-hidden="true" weight="bold" />}</button>)}</div>}</div>
}

export default function StudyPage({ analyze }: { analyze: (text: string) => void }) {
  const [text, setText] = useState('')
  const submit = () => {
    const sentence = text.trim()
    if (sentence) analyze(sentence)
  }

  return <div className="page narrow"><section className="card input-card"><div className="study-heading"><h1>학습할 언어와 문구를 입력하세요</h1><div className="language-selectors"><LanguageSelect defaultValue="ko" ariaLabel="변경 전 언어"/><span className="language-arrow" aria-hidden="true"><ArrowRightIcon weight="bold" /></span><LanguageSelect defaultValue="en" ariaLabel="변경 후 언어"/></div></div><textarea value={text} maxLength={500} onChange={event => setText(event.target.value)} placeholder="학습하고 싶은 문장이나 문구를 입력해 주세요."/><div className="input-footer"><span>{text.length} / 500</span><button className="primary" disabled={!text.trim()} onClick={submit}><Icon>✦</Icon> AI 분석 시작</button></div></section><div className="empty-state"><span>✎</span><p>AI가 표현과 핵심 어휘를 분석해 드려요.</p></div></div>
}
