import { useEffect, useRef, useState } from 'react'
import { BookmarkSimpleIcon, CaretDownIcon, CheckIcon, ClockCounterClockwiseIcon, HeartIcon, ListBulletsIcon, MagnifyingGlassIcon, SpeakerHighIcon, TranslateIcon, TrashIcon, TrophyIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteVocabulary, getVocabularies, setVocabularyFavorite } from '../services/vocabulary'

type VocabularyFilter = 'all' | 'favorite' | 'due' | 'mastered'
type VocabularyView = 'word' | 'meaning' | 'both'

export default function VocabularyPage() {
  const [filter, setFilter] = useState<VocabularyFilter>('all')
  const [view, setView] = useState<VocabularyView>('both')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string>()
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
  const toggleExampleTranslation = (vocabularyId: string) => {
    setTranslatedExamples(previous => {
      const next = new Set(previous)
      if (next.has(vocabularyId)) next.delete(vocabularyId)
      else next.add(vocabularyId)
      return next
    })
  }
  const saved = vocabulariesQuery.data ?? []
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visibleWords = saved.filter(word => {
    const matchesFilter = filter === 'all' || (filter === 'favorite' && word.isFavorite) || (filter === 'due' && word.progress.isDue) || (filter === 'mastered' && word.progress.masteryLevel >= 6)
    const matchesSearch = !normalizedSearch || [word.word, word.meaning, word.contextMeaning ?? ''].some(value => value.toLocaleLowerCase().includes(normalizedSearch))
    return matchesFilter && matchesSearch
  })
  const filters: Array<{ id: VocabularyFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'favorite', label: '즐겨찾기' },
    { id: 'due', label: '복습' },
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
    <header className="vocabulary-toolbar"><div className="vocabulary-heading"><div><BookmarkSimpleIcon weight="fill"/><h1>내 단어장</h1><span>{saved.length}개</span></div><div className={`vocabulary-view-menu${viewMenuOpen ? ' open' : ''}`} ref={viewMenuRef}><button type="button" className="vocabulary-view-trigger" aria-haspopup="listbox" aria-expanded={viewMenuOpen} onClick={() => setViewMenuOpen(open => !open)}><span>{views.find(item => item.id === view)?.label}</span><CaretDownIcon weight="bold"/></button>{viewMenuOpen && <div className="vocabulary-view-options" role="listbox" aria-label="단어 표시 방식">{views.map(item => <button type="button" role="option" aria-selected={view === item.id} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setViewMenuOpen(false) }} key={item.id}><span>{item.label}</span>{view === item.id && <CheckIcon weight="bold"/>}</button>)}</div>}</div></div><label className="vocabulary-search"><MagnifyingGlassIcon/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="단어나 뜻을 검색하세요" aria-label="단어장 검색"/></label><div className="vocab-filters" role="tablist" aria-label="단어장 필터">{filters.map(item => <button role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)} key={item.id}>{item.id === 'all' ? <ListBulletsIcon weight="bold"/> : item.id === 'favorite' ? <HeartIcon weight="fill"/> : item.id === 'due' ? <ClockCounterClockwiseIcon weight="bold"/> : <TrophyIcon weight="fill"/>}{item.label}</button>)}</div></header>

    {vocabulariesQuery.isPending ? <div className="empty-state"><p>단어장을 불러오고 있어요.</p></div>
      : vocabulariesQuery.isError ? <div className="empty-state"><p>{vocabulariesQuery.error.message}</p><button className="primary" onClick={() => void vocabulariesQuery.refetch()}>다시 시도</button></div>
        : !saved.length ? <div className="empty-state vocabulary-empty"><BookmarkSimpleIcon/><h2>아직 저장한 단어가 없어요</h2><p>AI 문장 분석의 핵심 어휘에서 북마크를 누르면<br/>이곳에서 다시 학습할 수 있어요.</p></div>
          : !visibleWords.length ? <div className="empty-state vocabulary-empty"><MagnifyingGlassIcon/><h2>조건에 맞는 단어가 없어요</h2><p>검색어나 필터를 바꿔보세요.</p></div>
            : <div className="word-grid compact-word-grid">{visibleWords.map(word => {
              const expanded = expandedId === word.vocabularyId
              return <article className={`word-card compact-word-card${expanded ? ' expanded' : ''}`} key={word.vocabularyId}>
                <div className="compact-word-top"><div className={`compact-word-name${view === 'meaning' ? ' meaning-primary' : ''}`}><div><h2>{view === 'meaning' ? word.meaning : word.word}</h2>{view !== 'meaning' && word.cefrLevel && <span>{word.cefrLevel}</span>}<button className="word-inline-expand" aria-label={`${word.word} 상세 정보 ${expanded ? '접기' : '보기'}`} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? undefined : word.vocabularyId)}><CaretDownIcon weight="bold"/></button></div>{view !== 'meaning' && <small>{word.languageCode.toUpperCase()}</small>}</div><div className="compact-word-actions"><button className={`favorite-heart${word.isFavorite ? ' active' : ''}`} disabled={toggleFavorite.isPending && toggleFavorite.variables?.vocabularyId === word.vocabularyId} aria-label={word.isFavorite ? `${word.word} 즐겨찾기 해제` : `${word.word} 즐겨찾기 추가`} aria-pressed={word.isFavorite} onClick={() => toggleFavorite.mutate({ vocabularyId: word.vocabularyId, favorite: !word.isFavorite })}><HeartIcon weight={word.isFavorite ? 'fill' : 'regular'}/></button><button aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, word.languageCode)}><SpeakerHighIcon/></button><button className="compact-delete" disabled={removeVocabulary.isPending && removeVocabulary.variables === word.vocabularyId} aria-label={`${word.word} 단어장에서 삭제`} onClick={() => removeVocabulary.mutate(word.vocabularyId)}><TrashIcon/></button></div></div>
                {view === 'both' && <p className="compact-word-meaning">{word.meaning}</p>}
                {expanded && <div className="word-details">{word.contextMeaning && <div><b>문맥 뜻</b><p>{word.contextMeaning}</p></div>}{word.exampleSentence && <div><div className="word-detail-heading"><b>예문</b><div>{word.exampleTranslation && <button type="button" className={translatedExamples.has(word.vocabularyId) ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${translatedExamples.has(word.vocabularyId) ? '숨기기' : '보기'}`} aria-pressed={translatedExamples.has(word.vocabularyId)} onClick={() => toggleExampleTranslation(word.vocabularyId)}><TranslateIcon/></button>}<button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence!, word.languageCode)}><SpeakerHighIcon/></button></div></div><blockquote>{word.exampleSentence}</blockquote>{translatedExamples.has(word.vocabularyId) && word.exampleTranslation && <p className="word-example-translation">{word.exampleTranslation}</p>}</div>}{word.etymology && <div><b>어원</b><p>{word.etymology}</p></div>}{word.memoryTip && <div className="word-memory-tip"><b>암기 팁</b><p>💡 {word.memoryTip}</p></div>}</div>}
              </article>
            })}</div>}
    {(removeVocabulary.isError || toggleFavorite.isError) && <p className="vocabulary-error" role="alert">{removeVocabulary.error?.message ?? toggleFavorite.error?.message}</p>}
  </div>
}
