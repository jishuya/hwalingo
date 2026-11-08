import LoginRequired from '../components/ui/LoginRequired'
import { getActiveIncorrectPractice } from '../services/quiz'
import VocabularyWordCard, { type VocabularyView } from '../components/vocabulary/VocabularyWordCard'
import LearningTimer from '../components/learning/LearningTimer'
import { useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, CaretDownIcon, XCircleIcon, GlobeIcon, ListBulletsIcon, MagnifyingGlassIcon, StarIcon, PlayIcon, TrashIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { languageOptions, type LanguageCode } from '../services/analysis'
import { VocabularyRequestError, deleteVocabulary, getVocabularies, setVocabularyFavorite } from '../services/vocabulary'

type VocabularyFilter = 'all' | 'favorite' | 'incorrect'

const languageFlags: Record<LanguageCode, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸',
}

export default function VocabularyPage({ onIncorrectTest }: { onIncorrectTest: (vocabularyIds?:string[]) => void }) {
  const activePracticeQuery=useQuery({queryKey:['quiz','active-practice'],queryFn:getActiveIncorrectPractice})
  const [selectedPracticeIds,setSelectedPracticeIds] = useState<Set<string>>(()=>new Set())
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState<VocabularyFilter>('all')
  const [selectedLanguage, setLanguageFilter] = useState<'all' | LanguageCode>('all')
  const [view, setView] = useState<VocabularyView>('both')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string>()
  const queryClient = useQueryClient()
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const removeVocabulary = useMutation({
    mutationFn: deleteVocabulary,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
        queryClient.invalidateQueries({ queryKey: ['quiz'] }),
      ])
    },
  })
  const toggleFavorite = useMutation({
    mutationFn: ({ vocabularyId, favorite }: { vocabularyId: string; favorite: boolean }) => setVocabularyFavorite(vocabularyId, favorite),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }),
  })
  const needsLogin = vocabulariesQuery.error instanceof VocabularyRequestError && vocabulariesQuery.error.status === 401
  const saved = vocabulariesQuery.data ?? []
  const incorrectWords=saved.filter(word=>word.progress.incorrectCount>0&&!word.incorrectPracticeExcluded)
  const activePractice=activePracticeQuery.data?.status==='active'?activePracticeQuery.data:null
  const selectedPracticeWords=incorrectWords.filter(word=>selectedPracticeIds.has(word.vocabularyId))
  const togglePracticeWord = (id:string) => setSelectedPracticeIds(previous=>{
    const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next
  })
  const savedLanguages = new Set(saved.map(word => word.languageCode))
  const availableLanguages = languageOptions.filter(language => savedLanguages.has(language.code))
  const languageFilter = selectedLanguage === 'all' || savedLanguages.has(selectedLanguage) ? selectedLanguage : 'all'
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const matchingWords = saved.filter(word => {
    const matchesLanguage = languageFilter === 'all' || word.languageCode === languageFilter
    const matchesSearch = !normalizedSearch || [word.word, word.meaning, word.contextMeaning ?? ''].some(value => value.toLocaleLowerCase().includes(normalizedSearch))
    return matchesLanguage && matchesSearch
  })
  const matchesFilter = (word: typeof saved[number], id: VocabularyFilter) => id === 'all' || (id === 'favorite' && word.isFavorite) || (id === 'incorrect' && word.progress.incorrectCount > 0 && !word.incorrectPracticeExcluded)
  const visibleWords = matchingWords.filter(word => matchesFilter(word, filter))
  const filters: Array<{ id: VocabularyFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: 'favorite', label: '즐겨찾기' },
    { id: 'incorrect', label: '틀린단어' },
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

  return <div className="page vocabulary-page"><LearningTimer activity="vocabulary" enabled={Boolean(expandedId) && saved.some(word => word.vocabularyId === expandedId)}/>
    <header className="page-title vocabulary-page-title"><span className="page-title-icon"><StarIcon weight="fill"/></span><h1>내 단어장</h1><strong>{saved.length}개</strong><div className={`vocabulary-view-menu${viewMenuOpen ? ' open' : ''}`} ref={viewMenuRef}><button type="button" className="vocabulary-view-trigger" aria-haspopup="listbox" aria-expanded={viewMenuOpen} onClick={() => setViewMenuOpen(open => !open)}><span>{views.find(item => item.id === view)?.label}</span><CaretDownIcon weight="bold"/></button>{viewMenuOpen && <div className="vocabulary-view-options" role="listbox" aria-label="단어 표시 방식">{views.map(item => <button type="button" role="option" aria-selected={view === item.id} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setViewMenuOpen(false) }} key={item.id}><span>{item.label}</span></button>)}</div>}</div></header>
    <header className="vocabulary-toolbar"><label className="vocabulary-search"><MagnifyingGlassIcon/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="단어나 뜻을 검색하세요" aria-label="단어장 검색"/></label><div className="vocabulary-language-navigation">
      <div className="story-selector-languages vocabulary-language-filters" role="tablist" aria-label="언어별 필터">
        <button type="button" role="tab" aria-selected={languageFilter === 'all'} className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}><GlobeIcon weight="bold" aria-hidden="true"/>전체 언어</button>
        {availableLanguages.map(language => <button type="button" role="tab" aria-selected={languageFilter === language.code} className={languageFilter === language.code ? 'active' : ''} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })} onClick={() => setLanguageFilter(language.code)} key={language.code}><span className="vocabulary-language-flag" aria-hidden="true">{languageFlags[language.code]}</span>{language.label}</button>)}
      </div>
    </div><div className="vocab-filters" role="tablist" aria-label="단어장 필터">{filters.map(item => <button role="tab" aria-selected={filter === item.id} className={`vocabulary-filter-${item.id}${filter === item.id ? ' active' : ''}`} onClick={() => { setFilter(item.id); setEditing(false) }} key={item.id}>{item.id === 'all' ? <ListBulletsIcon weight="bold"/> : item.id === 'favorite' ? <StarIcon weight="bold"/> : <XCircleIcon weight="bold"/>}<span className="vocabulary-filter-label">{item.label} <b>{matchingWords.filter(word => matchesFilter(word, item.id)).length}</b></span></button>)}</div></header>

    {filter === 'all' && saved.length > 0 && <div className="vocabulary-practice-selection vocabulary-edit-toolbar"><button type="button" aria-pressed={editing} onClick={() => setEditing(value => !value)}>{!editing && <TrashIcon aria-hidden="true"/>}{editing ? '완료' : '단어 삭제'}</button>{editing && <span>마이너스 버튼을 눌러 단어를 삭제하세요</span>}</div>}

    {filter === 'incorrect' && <><div className="vocabulary-incorrect-test"><button type="button" className="vocabulary-practice-start" disabled={vocabulariesQuery.isPending||vocabulariesQuery.isError||activePracticeQuery.isPending||activePracticeQuery.isError||!incorrectWords.length} onClick={()=>onIncorrectTest(selectedPracticeWords.length?selectedPracticeWords.map(word=>word.vocabularyId):activePractice?.practiceVocabularyIds??undefined)}><span className="practice-start-icon" aria-hidden="true"><PlayIcon weight="fill"/></span><span className="practice-start-copy"><strong>틀린단어 집중 연습</strong><small>{selectedPracticeWords.length > 0 ? `선택한 ${selectedPracticeWords.length}개 단어 집중 풀기` : `연습이 필요한 ${incorrectWords.length}개 단어 집중 풀기`}</small></span><span className="practice-start-badge">시작</span></button></div>
      {visibleWords.length>0&&<div className="vocabulary-practice-selection"><label><input type="checkbox" aria-label="전체 선택" checked={visibleWords.every(word=>selectedPracticeIds.has(word.vocabularyId))} onChange={()=>setSelectedPracticeIds(previous=>{
        const next=new Set(previous);const all=visibleWords.every(word=>next.has(word.vocabularyId));visibleWords.forEach(word=>{if(all)next.delete(word.vocabularyId);else next.add(word.vocabularyId)});return next
      })}/>전체 선택</label>{selectedPracticeWords.length>0&&<button type="button" onClick={()=>setSelectedPracticeIds(new Set())}>선택 해제</button>}</div>}
      {activePracticeQuery.isError&&<p role="alert" className="vocabulary-error">집중 연습을 불러오지 못했어요. <button type="button" onClick={()=>void activePracticeQuery.refetch()}>다시 시도</button></p>}
    </>}

    {vocabulariesQuery.isPending ? <div className="empty-state"><p>단어장을 불러오고 있어요.</p></div>
      : needsLogin ? <LoginRequired/>
      : vocabulariesQuery.isError ? <section className="vocabulary-load-error" role="alert"><span className="vocabulary-load-error-icon" aria-hidden="true"><ArrowClockwiseIcon/></span><h2>단어장을 불러오지 못했어요</h2><p>잠시 후 다시 시도해 주세요.</p><button type="button" className="primary" onClick={() => void vocabulariesQuery.refetch()}>다시 불러오기</button></section>
        : !saved.length ? <div className="empty-state vocabulary-empty"><StarIcon/><h2>아직 저장한 단어가 없어요</h2><p>AI 문장 분석의 핵심 어휘에서 즐겨찾기 별표를 누르면<br/>이곳에서 다시 학습할 수 있어요.</p></div>
          : !visibleWords.length ? <div className="empty-state vocabulary-empty"><MagnifyingGlassIcon/><h2>조건에 맞는 단어가 없어요</h2></div>
            : <div className="word-grid compact-word-grid">{visibleWords.map(word => {
              const expanded = expandedId === word.vocabularyId
              return <VocabularyWordCard key={word.vocabularyId} word={word} expanded={expanded} view={view}
                onToggle={()=>setExpandedId(expanded?undefined:word.vocabularyId)}
                onToggleFavorite={filter==='incorrect'?undefined:()=>toggleFavorite.mutate({vocabularyId:word.vocabularyId,favorite:!word.isFavorite})}
                favoritePending={toggleFavorite.isPending&&toggleFavorite.variables?.vocabularyId===word.vocabularyId}
                selection={filter==='incorrect'?{checked:selectedPracticeIds.has(word.vocabularyId),onChange:()=>togglePracticeWord(word.vocabularyId)}:undefined}
                onDelete={filter==='all'&&editing?()=>removeVocabulary.mutate(word.vocabularyId):undefined}
                deletePending={removeVocabulary.isPending&&removeVocabulary.variables===word.vocabularyId}/>
            })}</div>}
    {(removeVocabulary.isError || toggleFavorite.isError) && <p className="vocabulary-error" role="alert">{removeVocabulary.error?.message ?? toggleFavorite.error?.message}</p>}
  </div>
}
