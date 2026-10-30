import { useEffect, useRef, useState } from 'react'
import { SparkleIcon, LightbulbIcon, PlantIcon, CaretDownIcon, XCircleIcon, GlobeIcon, ListBulletsIcon, MagnifyingGlassIcon, SpeakerHighIcon, TranslateIcon, StarIcon, TrashIcon, TrophyIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { languageOptions, type LanguageCode } from '../services/analysis'
import { deleteVocabulary, getVocabularies, setVocabularyFavorite } from '../services/vocabulary'

type VocabularyFilter = 'all' | 'favorite' | 'incorrect' | 'mastered'
type VocabularyView = 'word' | 'meaning' | 'both'

const languageFlags: Record<LanguageCode, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  fr: '🇫🇷',
}

function highlightVocabularyText(text: string, word: string, memoryTip = false) {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return text
  // Keep Latin words whole while allowing vocabulary in unspaced languages.
  const term = /[\p{Script=Latin}]/u.test(word)
    ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`
    : escaped
  const quoted = memoryTip ? '|[“「『‘][^”」』’\\n]+[”」』’]|"[^"\\n]+"|\'[^\'\\n]+\'' : ''
  const pattern = new RegExp(`(${term}${quoted})`, 'giu')
  return text.split(pattern).map((part, index) => index % 2 === 1
    ? <mark className={memoryTip ? 'vocabulary-tip-highlight' : 'vocabulary-example-highlight'} key={index}>{part}</mark>
    : part)
}

export default function VocabularyPage() {
  const [filter, setFilter] = useState<VocabularyFilter>('all')
  const [selectedLanguage, setLanguageFilter] = useState<'all' | LanguageCode>('all')
  const [view, setView] = useState<VocabularyView>('both')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string>()
  const [pronouncingId, setPronouncingId] = useState<string>()
  const pronunciationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(pronunciationTimer.current), [])
  const [translatedExamples, setTranslatedExamples] = useState<Set<string>>(() => new Set())
  const queryClient = useQueryClient()
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const removeVocabulary = useMutation({
    mutationFn: deleteVocabulary,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
  })
  const toggleFavorite = useMutation({
    mutationFn: ({ vocabularyId, favorite }: { vocabularyId: string; favorite: boolean }) => setVocabularyFavorite(vocabularyId, favorite),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
  })
  const speak = (word: string, languageCode: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = languageCode === 'en' ? 'en-US' : languageCode === 'fr' ? 'fr-FR' : languageCode
    window.speechSynthesis.speak(utterance)
  }
  const pronounceWord = (vocabularyId: string, word: string, languageCode: string) => {
    speak(word, languageCode)
    clearTimeout(pronunciationTimer.current)
    setPronouncingId(vocabularyId)
    pronunciationTimer.current = setTimeout(() => setPronouncingId(undefined), 700)
  }
  const toggleExampleTranslation = (vocabularyId: string) => {
    setTranslatedExamples(previous => {
      const next = new Set(previous)
      if (next.has(vocabularyId)) next.delete(vocabularyId)
      else next.add(vocabularyId)
      return next
    })
  }
  const saved = vocabulariesQuery.data ?? []
  const savedLanguages = new Set(saved.map(word => word.languageCode))
  const availableLanguages = languageOptions.filter(language => savedLanguages.has(language.code))
  const languageFilter = selectedLanguage === 'all' || savedLanguages.has(selectedLanguage) ? selectedLanguage : 'all'
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const matchingWords = saved.filter(word => {
    const matchesLanguage = languageFilter === 'all' || word.languageCode === languageFilter
    const matchesSearch = !normalizedSearch || [word.word, word.meaning, word.contextMeaning ?? ''].some(value => value.toLocaleLowerCase().includes(normalizedSearch))
    return matchesLanguage && matchesSearch
  })
  const matchesFilter = (word: typeof saved[number], id: VocabularyFilter) => id === 'all' || (id === 'favorite' && word.isFavorite) || (id === 'incorrect' && word.progress.incorrectCount > 0) || (id === 'mastered' && word.progress.masteryLevel >= 6)
  const visibleWords = matchingWords.filter(word => matchesFilter(word, filter))
  const filters: Array<{ id: VocabularyFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'favorite', label: '즐겨찾기' },
    { id: 'incorrect', label: '오답단어' },
    { id: 'mastered', label: '마스터' },
  ]
  const views: Array<{ id: VocabularyView; label: string }> = [
    { id: 'word', label: '단어만' },
    { id: 'meaning', label: '뜻만' },
    { id: 'both', label: '단어 + 뜻' },
  ]
  useEffect(() => {
    if (!viewMenuOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!viewMenuRef.current?.contains(event.target as Node)) setViewMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [viewMenuOpen])

  return <div className="page vocabulary-page">
    <header className="page-title vocabulary-page-title"><span className="page-title-icon"><StarIcon weight="fill"/></span><h1>내 단어장</h1><strong>{saved.length}개</strong><div className={`vocabulary-view-menu${viewMenuOpen ? ' open' : ''}`} ref={viewMenuRef}><button type="button" className="vocabulary-view-trigger" aria-haspopup="listbox" aria-expanded={viewMenuOpen} onClick={() => setViewMenuOpen(open => !open)}><span>{views.find(item => item.id === view)?.label}</span><CaretDownIcon weight="bold"/></button>{viewMenuOpen && <div className="vocabulary-view-options" role="listbox" aria-label="단어 표시 방식">{views.map(item => <button type="button" role="option" aria-selected={view === item.id} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setViewMenuOpen(false) }} key={item.id}><span>{item.label}</span></button>)}</div>}</div></header>
    <header className="vocabulary-toolbar"><label className="vocabulary-search"><MagnifyingGlassIcon/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="단어나 뜻을 검색하세요" aria-label="단어장 검색"/></label><div className="vocabulary-language-navigation">
      <div className="story-selector-languages vocabulary-language-filters" role="tablist" aria-label="언어별 필터">
        <button type="button" role="tab" aria-selected={languageFilter === 'all'} className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}><GlobeIcon weight="bold" aria-hidden="true"/>전체 언어</button>
        {availableLanguages.map(language => <button type="button" role="tab" aria-selected={languageFilter === language.code} className={languageFilter === language.code ? 'active' : ''} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })} onClick={() => setLanguageFilter(language.code)} key={language.code}><span className="vocabulary-language-flag" aria-hidden="true">{languageFlags[language.code]}</span>{language.label}</button>)}
      </div>
    </div><div className="vocab-filters" role="tablist" aria-label="단어장 필터">{filters.map(item => <button role="tab" aria-selected={filter === item.id} className={`vocabulary-filter-${item.id}${filter === item.id ? ' active' : ''}`} onClick={() => setFilter(item.id)} key={item.id}>{item.id === 'all' ? <ListBulletsIcon weight="bold"/> : item.id === 'favorite' ? <StarIcon weight="bold"/> : item.id === 'incorrect' ? <XCircleIcon weight="bold"/> : <TrophyIcon weight="bold"/>}<span className="vocabulary-filter-label">{item.label} <b>{matchingWords.filter(word => matchesFilter(word, item.id)).length}</b></span></button>)}</div></header>

    {vocabulariesQuery.isPending ? <div className="empty-state"><p>단어장을 불러오고 있어요.</p></div>
      : vocabulariesQuery.isError ? <div className="empty-state"><p>{vocabulariesQuery.error.message}</p><button className="primary" onClick={() => void vocabulariesQuery.refetch()}>다시 시도</button></div>
        : !saved.length ? <div className="empty-state vocabulary-empty"><StarIcon/><h2>아직 저장한 단어가 없어요</h2><p>AI 문장 분석의 핵심 어휘에서 즐겨찾기 별표를 누르면<br/>이곳에서 다시 학습할 수 있어요.</p></div>
          : !visibleWords.length ? <div className="empty-state vocabulary-empty"><MagnifyingGlassIcon/><h2>조건에 맞는 단어가 없어요</h2></div>
            : <div className="word-grid compact-word-grid">{visibleWords.map(word => {
              const expanded = expandedId === word.vocabularyId
              return <article className={`word-card compact-word-card${expanded ? ' expanded' : ''}`} key={word.vocabularyId} onClick={event => {
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
                setExpandedId(expanded ? undefined : word.vocabularyId)
              }}>
                <div className="compact-word-top"><div className={`compact-word-name${view === 'meaning' ? ' meaning-primary' : ''}`}><div className="vocabulary-word-summary"><div className="vocabulary-word-heading"><button className={`favorite-star${word.isFavorite ? ' active' : ''}`} disabled={toggleFavorite.isPending && toggleFavorite.variables?.vocabularyId === word.vocabularyId} aria-label={word.isFavorite ? `${word.word} 즐겨찾기 해제` : `${word.word} 즐겨찾기 추가`} aria-pressed={word.isFavorite} onClick={() => toggleFavorite.mutate({ vocabularyId: word.vocabularyId, favorite: !word.isFavorite })}><StarIcon weight={word.isFavorite ? 'fill' : 'regular'}/></button><h2><button type="button" className={`vocabulary-pronounce${pronouncingId === word.vocabularyId ? ' playing' : ''}`} aria-label={`${word.word} 상세 정보 ${expanded ? '접기' : '보기'}`} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? undefined : word.vocabularyId)}>{view === 'meaning' ? word.meaning : word.word}</button></h2><small className="word-language-badge">{word.languageCode.toUpperCase()}</small>{view !== 'meaning' && word.cefrLevel && <span>{word.cefrLevel}</span>}</div></div></div><div className="compact-word-actions"><button type="button" className="compact-pronunciation" aria-label={`${word.word} 발음 듣기`} onClick={() => pronounceWord(word.vocabularyId, word.word, word.languageCode)}><SpeakerHighIcon/></button><button className="compact-delete" disabled={removeVocabulary.isPending && removeVocabulary.variables === word.vocabularyId} aria-label={`${word.word} 단어장에서 삭제`} onClick={() => removeVocabulary.mutate(word.vocabularyId)}><TrashIcon/></button></div></div><div className="vocabulary-meaning-row">{view === 'both' && <p className="compact-word-meaning vocabulary-full-width-meaning"><button type="button" className="vocabulary-meaning-toggle" aria-expanded={expanded} aria-label={`${word.word} 상세 정보 ${expanded ? '접기' : '보기'}`} onClick={() => setExpandedId(expanded ? undefined : word.vocabularyId)}>{word.meaning}</button></p>}</div>
                {expanded && word.contextMeaning && <div className="vocabulary-meaning-group">{ <div className="vocabulary-context"><b>문맥:</b><p>{word.contextMeaning}</p></div>}</div>}
                {expanded && <div className="word-details">{word.exampleSentence && <div className="vocabulary-example"><div className="word-detail-heading"><b><SparkleIcon weight="fill" aria-hidden="true"/>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence!, word.languageCode)}><SpeakerHighIcon/></button>{word.exampleTranslation && <button type="button" className={translatedExamples.has(word.vocabularyId) ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${translatedExamples.has(word.vocabularyId) ? '숨기기' : '보기'}`} aria-pressed={translatedExamples.has(word.vocabularyId)} onClick={() => toggleExampleTranslation(word.vocabularyId)}><TranslateIcon/></button>}</div></div><blockquote>{word.exampleTranslation ? <button type="button" className="vocabulary-example-toggle" aria-label={`${word.word} 예문 해석 ${translatedExamples.has(word.vocabularyId) ? '숨기기' : '보기'}`} aria-expanded={translatedExamples.has(word.vocabularyId)} onClick={() => toggleExampleTranslation(word.vocabularyId)}>{highlightVocabularyText(word.exampleSentence, word.word)}</button> : highlightVocabularyText(word.exampleSentence, word.word)}</blockquote>{translatedExamples.has(word.vocabularyId) && word.exampleTranslation && <p className="word-example-translation">{word.exampleTranslation}</p>}</div>}{word.etymology && <div className="vocabulary-etymology"><b><PlantIcon weight="fill"/> 어원</b><p>{word.etymology}</p></div>}{word.memoryTip && <div className="word-memory-tip"><b><LightbulbIcon weight="fill"/> AI 스마트 암기 팁</b><p>{highlightVocabularyText(word.memoryTip, word.word, true)}</p></div>}</div>}
              </article>
            })}</div>}
    {(removeVocabulary.isError || toggleFavorite.isError) && <p className="vocabulary-error" role="alert">{removeVocabulary.error?.message ?? toggleFavorite.error?.message}</p>}
  </div>
}
