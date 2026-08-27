import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon, BookOpenTextIcon, CaretDownIcon, CheckCircleIcon, CheckIcon, MagnifyingGlassIcon, PencilSimpleIcon, SpeakerHighIcon, SparkleIcon, TranslateIcon, XIcon } from '@phosphor-icons/react'
import { AlertDialog, Modal } from '../components/ui/Dialog'
import { getVocabularies } from '../services/vocabulary'
import { createStory, type StoryDifficulty, type StoryGenre, type StoryLength } from '../services/story'

const genres: Array<{ value: StoryGenre; label: string }> = [{ value: 'daily', label: '일상' }, { value: 'adventure', label: '모험' }, { value: 'fantasy', label: '판타지' }, { value: 'mystery', label: '미스터리' }, { value: 'comedy', label: '코미디' }]
const lengths: Array<{ value: StoryLength; label: string }> = [{ value: 'short', label: '짧게' }, { value: 'medium', label: '보통' }, { value: 'long', label: '길게' }]
const difficulties: Array<{ value: StoryDifficulty; label: string }> = [{ value: 'easy', label: '쉬움' }, { value: 'normal', label: '보통' }, { value: 'hard', label: '어려움' }]

export default function StoryPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([])
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [wordFilter, setWordFilter] = useState<'all' | 'favorite' | 'due'>('all')
  const [alert, setAlert] = useState<{ title: string; message: string }>()
  const [recommendSparkling, setRecommendSparkling] = useState(false)
  const [genre, setGenre] = useState<StoryGenre>('daily')
  const [length, setLength] = useState<StoryLength>('short')
  const [difficulty, setDifficulty] = useState<StoryDifficulty>('normal')
  const [translationVisible, setTranslationVisible] = useState(false)
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const storyMutation = useMutation({ mutationFn: createStory, onSuccess: () => { setTranslationVisible(false); window.setTimeout(() => document.querySelector('.story-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) } })
  const words = useMemo(() => vocabulariesQuery.data ?? [], [vocabulariesQuery.data])
  const selectedWords = words.filter(word => selectedIds.includes(word.vocabularyId))
  const selectedLanguage = selectedWords[0]?.languageCode
  const draftWords = words.filter(word => draftSelectedIds.includes(word.vocabularyId))
  const draftLanguage = draftWords[0]?.languageCode
  const minimum = 3
  const visibleWords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return words.filter(word => {
      const matchesSearch = !term || word.word.toLocaleLowerCase().includes(term) || word.meaning.toLocaleLowerCase().includes(term)
      const matchesFilter = wordFilter === 'all' || (wordFilter === 'favorite' && word.isFavorite) || (wordFilter === 'due' && word.progress.isDue)
      return matchesSearch && matchesFilter
    })
  }, [words, search, wordFilter])
  const openSelector = () => { setDraftSelectedIds(selectedIds); setSearch(''); setWordFilter('all'); setSelectorOpen(true) }
  const closeSelector = () => setSelectorOpen(false)
  const applySelection = () => {
    if (draftSelectedIds.length < minimum) {
      setAlert({ title: '단어를 3개 이상 선택해주세요', message: '스토리를 만들려면 같은 언어의 단어가 최소 3개 필요해요.' })
      return
    }
    const selectedLanguages = new Set(draftWords.map(word => word.languageCode))
    if (selectedLanguages.size > 1) {
      setAlert({ title: '같은 언어의 단어를 선택해주세요', message: '한 스토리에는 같은 언어의 단어만 함께 사용할 수 있어요.' })
      return
    }
    setSelectedIds(draftSelectedIds)
    setSelectorOpen(false)
    storyMutation.reset()
  }
  const toggleDraftWord = (id: string) => {
    if (draftSelectedIds.includes(id)) { setDraftSelectedIds(current => current.filter(item => item !== id)); return }
    const word = words.find(item => item.vocabularyId === id)
    if (draftLanguage && word?.languageCode !== draftLanguage) {
      setAlert({ title: '같은 언어의 단어를 선택해주세요', message: '한 스토리에는 같은 언어의 단어만 함께 사용할 수 있어요.' })
      return
    }
    if (draftSelectedIds.length >= 10) {
      setAlert({ title: '단어를 10개까지 선택할 수 있어요', message: '새 단어를 선택하려면 선택한 단어 하나를 먼저 해제해주세요.' })
      return
    }
    setDraftSelectedIds(current => [...current, id])
  }
  const recommendedIds = () => {
    const source = [...words].sort((a, b) => Number(b.progress.isDue) - Number(a.progress.isDue) || a.progress.masteryLevel - b.progress.masteryLevel)
    const language = source[0]?.languageCode
    return source.filter(word => word.languageCode === language).slice(0, 5).map(word => word.vocabularyId)
  }
  const selectRecommended = () => { setSelectedIds(recommendedIds()); storyMutation.reset() }
  const selectDraftRecommended = () => { setDraftSelectedIds(recommendedIds()); setRecommendSparkling(true) }
  const removeSelectedWord = (vocabularyId: string) => { setSelectedIds(current => current.filter(id => id !== vocabularyId)); storyMutation.reset() }
  const resetSettings = () => { setGenre('daily'); setLength('short'); setDifficulty('normal'); storyMutation.reset() }
  const generate = () => {
    if (selectedIds.length < minimum) {
      setAlert({ title: '단어를 3개 이상 선택해주세요', message: '단어 선택 또는 변경 버튼을 눌러 같은 언어의 단어를 골라주세요.' })
      return
    }
    storyMutation.mutate({ vocabularyIds: selectedIds, genre, length, difficulty })
  }
  const speak = (text: string) => {
    if (!selectedLanguage || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage
    window.speechSynthesis.speak(utterance)
  }
  const startWithNewWords = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSelectedIds([])
    setTranslationVisible(false)
    storyMutation.reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const resetWordSelection = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSelectedIds([])
    setTranslationVisible(false)
    storyMutation.reset()
  }

  return <div className="page story-page">
    <header className="page-title"><span className="page-title-icon"><SparkleIcon weight="fill"/></span><h1>AI 스토리텔링</h1></header>
    {vocabulariesQuery.isPending ? <div className="card story-state"><p>단어장을 불러오고 있어요.</p></div>
      : vocabulariesQuery.isError ? <div className="card story-state"><p>{vocabulariesQuery.error.message}</p><button className="primary" onClick={() => void vocabulariesQuery.refetch()}>다시 시도</button></div>
        : !words.length ? <div className="card story-state"><BookOpenTextIcon/><h2>스토리에 사용할 단어가 없어요</h2><p>문장 분석에서 단어를 저장하면 이곳에서 이야기로 복습할 수 있어요.</p></div>
          : <>
            <section className="card story-builder">
              <div className="story-section-heading"><div className="story-step-title"><span className="story-step-number">1</span><h2>단어 선택</h2>{selectedIds.length > 0 && <small className="story-word-count">{selectedIds.length}/10</small>}</div>{selectedIds.length > 0 && <button type="button" className="story-word-refresh" aria-label="단어 선택 초기화" title="단어 다시 선택" onClick={resetWordSelection}><ArrowClockwiseIcon weight="bold"/></button>}</div>
              {selectedWords.length ? <div className="story-selection-summary"><div className="selected-word-chips">{selectedWords.map(word => <span key={word.vocabularyId}>{word.word}<button type="button" aria-label={`${word.word} 선택 해제`} onClick={() => removeSelectedWord(word.vocabularyId)}><XIcon weight="bold"/></button></span>)}</div><button type="button" className="story-change-words" onClick={openSelector}><PencilSimpleIcon/> 변경</button></div>
                : <div className="story-selection-empty"><div><button type="button" className="story-recommend-button" onClick={selectRecommended}><SparkleIcon weight="fill"/> 추천 단어 5개 선택</button><button type="button" onClick={openSelector}>직접 선택</button></div></div>}
              <div className="story-options"><div className="story-section-heading"><div className="story-step-title"><span className="story-step-number">2</span><h2>스토리 설정</h2></div><button type="button" className="story-settings-refresh" aria-label="스토리 설정 초기화" title="기본 설정으로 되돌리기" onClick={resetSettings}><ArrowClockwiseIcon weight="bold"/></button></div><div className="story-inline-settings">
                <StorySelect label="장르" value={genre} options={genres} onChange={value => { setGenre(value); storyMutation.reset() }}/>
                <StorySelect label="길이" value={length} options={lengths} onChange={value => { setLength(value); storyMutation.reset() }}/>
                <StorySelect label="난이도" value={difficulty} options={difficulties} onChange={value => { setDifficulty(value); storyMutation.reset() }}/>
              </div></div>
              <button className={`primary story-generate${storyMutation.isPending ? ' loading' : ''}`} disabled={storyMutation.isPending} onClick={generate}>{storyMutation.isPending ? <><span className="story-loading-sparkles" aria-hidden="true"><SparkleIcon weight="fill"/><SparkleIcon weight="fill"/><SparkleIcon weight="fill"/></span><span>이야기를 만들고 있어요…</span></> : <><SparkleIcon weight="fill"/><span>선택한 {selectedIds.length}개 단어로 스토리 만들기</span></>}</button>
              {storyMutation.isError && <p className="story-error" role="alert">{storyMutation.error.message} 선택한 단어는 그대로 유지됩니다.</p>}
            </section>
            {storyMutation.data && <article className="card story-card story-result">
              <div className="story-title"><div><span>AI STORY · {genres.find(item => item.value === genre)?.label}</span><h2>{storyMutation.data.title}</h2></div><button className="round" aria-label="스토리 전체 듣기" onClick={() => speak(storyMutation.data.story)}><SpeakerHighIcon/></button></div>
              <h3>STORY</h3><p>{storyMutation.data.segments.map((segment, index) => segment.vocabularyId ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</p>
              <hr/><section className="story-translation"><button type="button" aria-expanded={translationVisible} onClick={() => setTranslationVisible(visible => !visible)}><TranslateIcon weight="bold"/>한국어 번역 {translationVisible ? '숨기기' : '보기'}</button>{translationVisible && <div><h3>한국어 번역</h3><p className="translation">{storyMutation.data.translation}</p></div>}</section>
              <div className="story-usage"><h3>사용한 단어 {storyMutation.data.vocabularyUsages.length}/{selectedIds.length}</h3><div>{storyMutation.data.vocabularyUsages.map(usage => <span key={usage.vocabularyId}><CheckCircleIcon weight="fill"/>{usage.word}<small>{usage.meaning}</small></span>)}</div></div>
              <div className="story-result-actions"><button onClick={generate} disabled={storyMutation.isPending}><ArrowClockwiseIcon/> 같은 단어로 다시 만들기</button><button onClick={startWithNewWords}>새 단어 선택</button></div>
            </article>}
          </>}
    <Modal open={selectorOpen} title="단어 선택" description={`같은 언어의 단어를 선택해주세요. (${draftSelectedIds.length}/10)`} onClose={closeSelector} size="large" footer={<><button className="ui-dialog-secondary" type="button" onClick={closeSelector}>취소</button><button className="ui-dialog-primary" type="button" onClick={applySelection}>선택한 {draftSelectedIds.length}개 적용</button></>}>
      <div className="story-selector">
        <label className="story-selector-search"><MagnifyingGlassIcon/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="단어나 뜻 검색" aria-label="스토리 단어 검색"/></label>
        <div className="story-selector-filters" role="tablist" aria-label="단어 필터">{([{ id: 'all', label: '전체' }, { id: 'favorite', label: '즐겨찾기' }, { id: 'due', label: '복습 예정' }] as const).map(filter => <button type="button" role="tab" aria-selected={wordFilter === filter.id} className={wordFilter === filter.id ? 'active' : ''} onClick={() => setWordFilter(filter.id)} key={filter.id}>{filter.label}</button>)}<button type="button" className={`recommend${recommendSparkling ? ' sparkling' : ''}`} onClick={selectDraftRecommended} onAnimationEnd={() => setRecommendSparkling(false)}><SparkleIcon weight="fill"/> 추천</button></div>
        <div className="story-word-grid story-selector-grid">{visibleWords.map(word => {
          const selected = draftSelectedIds.includes(word.vocabularyId)
          return <button type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => toggleDraftWord(word.vocabularyId)} key={word.vocabularyId}><span className="story-checkbox">{selected && <CheckIcon weight="bold"/>}</span><span><b>{word.word}</b><small>{word.meaning}</small></span><em>Lv.{word.progress.masteryLevel}</em></button>
        })}</div>
        {!visibleWords.length && <p className="story-selector-empty">조건에 맞는 단어가 없어요.</p>}
      </div>
    </Modal>
    <AlertDialog open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message ?? ''} tone="warning" onClose={() => setAlert(undefined)}/>
  </div>
}

function StorySelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value) ?? options[0]
  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])
  return <div className={`story-custom-select${open ? ' open' : ''}`} ref={rootRef}><span>{label}</span><button type="button" className="story-custom-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><b>{selected.label}</b><CaretDownIcon weight="bold"/></button>{open && <div className="story-custom-select-menu" role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={value === option.value} className={value === option.value ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false) }} key={option.value}><span>{option.label}</span>{value === option.value && <CheckIcon weight="bold"/>}</button>)}</div>}</div>
}
