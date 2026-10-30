import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowClockwiseIcon, BookOpenIcon, CaretRightIcon, CheckCircleIcon, CheckIcon, MagnifyingGlassIcon, ListBulletsIcon, XCircleIcon, LightningIcon, PlusIcon, SlidersHorizontalIcon, SpeakerHighIcon, SparkleIcon, StarIcon, TranslateIcon, XIcon } from '@phosphor-icons/react'
import { AlertDialog, Modal } from '../components/ui/Dialog'
import { recommendStoryWords } from '../domain/storyRecommendation'
import AiLoadingOverlay from '../components/ui/AiLoadingOverlay'
import { languageOptions, type LanguageCode } from '../services/analysis'
import { getVocabularies, type Vocabulary } from '../services/vocabulary'
import { createStory, getStoryTranslation, type StoryDifficulty, type StoryGenre, type StoryLength } from '../services/story'

const languageFlags: Record<LanguageCode, string> = { ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵', zh: '🇨🇳', fr: '🇫🇷' }

const genres: Array<{ value: StoryGenre; label: string }> = [
  { value: 'daily', label: '일상' }, { value: 'business', label: '비즈니스' },
  { value: 'romance', label: '로맨스' }, { value: 'mystery', label: '추리' },
]
const lengths: Array<{ value: StoryLength; label: string; description: string }> = [
  { value: 'short', label: '짧게', description: '3~4문장 구성' },
  { value: 'medium', label: '보통', description: '5~6문장 구성' },
  { value: 'long', label: '길게', description: '7~9문장 심화' },
]
const difficulties: Array<{ value: StoryDifficulty; label: string }> = [
  { value: 'easy', label: '초급 (A2)' }, { value: 'normal', label: '보통 (B1–B2)' }, { value: 'hard', label: '고급 (C1)' },
]

export default function StoryPage() {
  const queryClient = useQueryClient()
  const [selectionMode, setSelectionMode] = useState<'recommended' | 'manual' | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([])
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedLanguageFilter, setLanguageFilter] = useState<'all' | LanguageCode>('all')
  const [wordFilter, setWordFilter] = useState<'all' | 'favorite' | 'incorrect'>('all')
  const [alert, setAlert] = useState<{ title: string; message: string }>()
  const [recommendSparkling, setRecommendSparkling] = useState(false)
  const [genre, setGenre] = useState<StoryGenre>('daily')
  const [length, setLength] = useState<StoryLength>('short')
  const [difficulty, setDifficulty] = useState<StoryDifficulty>('normal')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftGenre, setDraftGenre] = useState<StoryGenre>('daily')
  const [draftLength, setDraftLength] = useState<StoryLength>('short')
  const [draftDifficulty, setDraftDifficulty] = useState<StoryDifficulty>('normal')
  const [translationVisible, setTranslationVisible] = useState(false)
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const translationMutation = useMutation({ mutationFn: getStoryTranslation })
  const storyMutation = useMutation({ mutationFn: createStory, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['vocabularies'] }); setTranslationVisible(false); translationMutation.reset(); window.setTimeout(() => document.querySelector('.story-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) } })
  const words = useMemo(() => vocabulariesQuery.data ?? [], [vocabulariesQuery.data])
  const savedLanguages = new Set(words.map(word => word.languageCode))
  const availableLanguages = languageOptions.filter(language => savedLanguages.has(language.code))
  const languageFilter = selectedLanguageFilter === 'all' || savedLanguages.has(selectedLanguageFilter) ? selectedLanguageFilter : 'all'
  const selectedWords = words.filter(word => selectedIds.includes(word.vocabularyId))
  const selectedLanguage = selectedWords[0]?.languageCode
  const storyTranslation = storyMutation.data?.translation
    || (translationMutation.variables?.story === storyMutation.data?.story ? translationMutation.data : '')
  const draftWords = words.filter(word => draftSelectedIds.includes(word.vocabularyId))
  const draftLanguage = draftWords[0]?.languageCode
  const minimum = 3
  const matchingWords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return words.filter(word => {
      const matchesSearch = !term || word.word.toLocaleLowerCase().includes(term) || word.meaning.toLocaleLowerCase().includes(term)
      const matchesLanguage = languageFilter === 'all' || word.languageCode === languageFilter
      return matchesSearch && matchesLanguage
    })
  }, [words, search, languageFilter])
  const matchesWordFilter = (word: Vocabulary, filter: typeof wordFilter) => filter === 'all'
    || (filter === 'favorite' && word.isFavorite)
    || (filter === 'incorrect' && word.progress.incorrectCount > 0)
  const visibleWords = matchingWords.filter(word => matchesWordFilter(word, wordFilter))
  const openSelector = () => { setDraftSelectedIds(selectedIds); setSearch(''); setLanguageFilter('all'); setWordFilter('all'); setSelectorOpen(true) }
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
    setSelectionMode('manual')
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
    if (draftSelectedIds.length >= 30) {
      setAlert({ title: '단어를 30개까지 선택할 수 있어요', message: '새 단어를 선택하려면 선택한 단어 하나를 먼저 해제해주세요.' })
      return
    }
    setDraftSelectedIds(current => [...current, id])
  }
  const recommendedIds = (candidates = words, preferredLanguage?: LanguageCode, previousIds = selectedIds) => {
    return recommendStoryWords(candidates, { language: preferredLanguage, previousIds }).map(word => word.vocabularyId)
  }
  const selectRecommended = () => { setSelectionMode('recommended'); setSelectedIds(recommendedIds(words, selectedLanguage)); storyMutation.reset() }
  const selectDraftRecommended = () => {
    const ids = recommendedIds(visibleWords, languageFilter === 'all' ? undefined : languageFilter, draftSelectedIds)
    if (ids.length < 5) {
      setAlert({
        title: '추천할 단어가 부족해요',
        message: `현재 선택한 필터에 맞는 같은 언어의 단어가 ${ids.length}개뿐이에요. 추천 단어 5개를 선택하려면 검색어나 필터를 변경해주세요.`,
      })
      return
    }
    setDraftSelectedIds(ids)
    setRecommendSparkling(true)
  }
  const removeSelectedWord = (vocabularyId: string) => { setSelectedIds(current => current.filter(id => id !== vocabularyId)); storyMutation.reset() }
  const openSettings = () => { setDraftGenre(genre); setDraftLength(length); setDraftDifficulty(difficulty); setSettingsOpen(true) }
  const applySettings = () => { setGenre(draftGenre); setLength(draftLength); setDifficulty(draftDifficulty); setSettingsOpen(false); storyMutation.reset() }
  const generate = () => {
    if (selectedIds.length < minimum) {
      setAlert({ title: '단어를 3개 이상 선택해주세요', message: '단어 선택 또는 변경 버튼을 눌러 같은 언어의 단어를 골라주세요.' })
      return
    }
    storyMutation.mutate({ vocabularyIds: selectedIds, genre, length, difficulty, forceRegenerate: Boolean(storyMutation.data) })
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
    setSelectionMode(null)
    setSelectedIds([])
    setTranslationVisible(false)
    translationMutation.reset()
    storyMutation.reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const toggleTranslation = () => {
    if (translationVisible) {
      setTranslationVisible(false)
      return
    }
    setTranslationVisible(true)
    if (!storyTranslation && storyMutation.data && selectedLanguage && !translationMutation.isPending) {
      translationMutation.mutate({ story: storyMutation.data.story, languageCode: selectedLanguage })
    }
  }

  return <div className="page story-page">
    <AiLoadingOverlay open={storyMutation.isPending} kind="story"/>
    <section className="story-intro" aria-labelledby="story-intro-title">
      <div className="story-intro-copy">
        <span className="story-intro-badge"><SparkleIcon weight="fill"/> 단어로 만드는 나만의 영어 이야기</span>
        <h1 id="story-intro-title">AI 스토리 빌더 <span aria-hidden="true">🪄</span></h1>
        <p>암기한 단어들을 실제 맥락 속 생생한 에피소드로 엮어 자연스럽게 체득해보세요.</p>
      </div>
    </section>
    {vocabulariesQuery.isPending ? <div className="card story-state"><p>단어장을 불러오고 있어요.</p></div>
      : vocabulariesQuery.isError ? <div className="card story-state"><p>{vocabulariesQuery.error.message}</p><button className="primary" onClick={() => void vocabulariesQuery.refetch()}>다시 시도</button></div>
        : !words.length ? <div className="empty-state vocabulary-empty"><StarIcon/><h2>스토리에 사용할 단어가 없어요</h2><p>AI 문장 분석의 핵심 어휘를 단어장에 저장하면<br/>이곳에서 이야기로 복습할 수 있어요.</p></div>
          : <>
            <section className="card story-builder">
              <div className="story-builder-grid">
                <div className="story-word-step">
                  <div className="story-section-heading">
                    <div className="story-step-title"><span className="story-step-number">1</span><h2>단어 선택</h2></div>
                  </div>
                  <div className="story-selection-methods">
                    <button type="button" className={`story-method-card story-recommend-card${selectionMode === 'recommended' ? ' active' : ''}`} aria-pressed={selectionMode === 'recommended'} aria-label={selectionMode === 'recommended' ? '단어 다시 추천받기' : '단어 5개 추천받기'} onClick={selectRecommended}>
                      <span className="story-method-icon"><LightningIcon weight="fill"/></span>
                      <span className="story-method-copy"><strong>추천 단어 자동 선택 <span className="story-recommend-count">5개</span></strong><small>복습이 필요한 단어 위주로 골랐어요</small></span>
                      <span className="story-recommend-action" aria-hidden="true"><CheckIcon weight="bold"/></span>
                    </button>
                    <button type="button" className={`story-method-card${selectionMode === 'manual' ? ' active' : ''}`} onClick={openSelector}>
                      <span className="story-method-icon"><BookOpenIcon/></span>
                      <span className="story-method-copy"><strong>직접 단어 선택</strong><small>내 단어장에서 고르기</small></span>
                      <span className="story-method-action">목록보기 <CaretRightIcon/></span>
                    </button>
                  </div>
                  <div className="story-picked-words">
                    <div className="story-picked-heading"><p>선택된 단어 <span className="story-picked-count" aria-live="polite">{selectedIds.length} / 30</span></p><button type="button" className="story-reset-words" aria-label="선택된 단어 초기화" title="선택 초기화" disabled={!selectedIds.length} onClick={() => { setSelectedIds([]); setDraftSelectedIds([]); setSelectionMode(null); storyMutation.reset() }}><ArrowClockwiseIcon/></button></div>
                    <div className="story-picked-chips">{selectedWords.map(word => <span key={word.vocabularyId}><b>{word.word}</b><small>{word.meaning}</small><button type="button" aria-label={`${word.word} 선택 해제`} onClick={() => removeSelectedWord(word.vocabularyId)}><XIcon weight="bold"/></button></span>)}</div>
                    <div className="story-picked-footer"><button type="button" className="story-add-word" onClick={openSelector}><PlusIcon weight="bold"/> 단어 추가</button></div>
                  </div>
                </div>
                <div className="story-options"><div className="story-section-heading"><div className="story-step-title"><span className="story-step-number">2</span><h2>스토리 설정</h2></div></div><div className="story-settings-summary"><button type="button" className="story-settings-card story-settings-selected" aria-label="스토리 설정 변경" onClick={openSettings}><span className="story-settings-edit"><SlidersHorizontalIcon weight="bold"/></span><span className="story-setting-value"><small>장르</small><b>{genres.find(item => item.value === genre)?.label}</b></span><span className="story-setting-value"><small>길이</small><b>{lengths.find(item => item.value === length)?.label}</b></span><span className="story-setting-value"><small>난이도</small><b>{difficulty === 'easy' ? '초급' : difficulty === 'hard' ? '고급' : '보통'}</b></span></button></div></div>
              </div>
              <button className={`primary story-generate${storyMutation.isPending ? ' loading' : ''}`} disabled={storyMutation.isPending} onClick={generate}>{storyMutation.isPending ? <><span className="story-loading-sparkles" aria-hidden="true"><SparkleIcon weight="fill"/><SparkleIcon weight="fill"/><SparkleIcon weight="fill"/></span><span>이야기를 만들고 있어요…</span></> : <><SparkleIcon weight="fill"/><span>선택한 {selectedIds.length}개 단어로 스토리 만들기</span></>}</button>
              {storyMutation.isError && <p className="story-error" role="alert">{storyMutation.error.message} 선택한 단어는 그대로 유지됩니다.</p>}
            </section>
            {storyMutation.data && <article className="card story-card story-result">
              <div className="story-title"><div><span>AI STORY · {genres.find(item => item.value === genre)?.label}</span><h2>{storyMutation.data.title}</h2></div><button className="round" aria-label="스토리 전체 듣기" onClick={() => speak(storyMutation.data.story)}><SpeakerHighIcon/></button></div>
              <h3>STORY</h3><p>{storyMutation.data.segments.map((segment, index) => segment.vocabularyId ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</p>
              <hr/><section className="story-translation"><button type="button" aria-expanded={translationVisible} onClick={toggleTranslation}><TranslateIcon weight="bold"/>한국어 번역 {translationVisible ? '숨기기' : '보기'}</button>{translationVisible && <div><h3>한국어 번역</h3>{translationMutation.isPending && <p className="translation">번역하고 있어요…</p>}{translationMutation.isError && <p className="story-error" role="alert">{translationMutation.error.message}</p>}{storyTranslation && <p className="translation">{storyTranslation}</p>}</div>}</section>
              <div className="story-usage"><h3>사용한 단어 {storyMutation.data.vocabularyUsages.length}/{selectedIds.length}</h3><div>{storyMutation.data.vocabularyUsages.map(usage => <span key={usage.vocabularyId}><CheckCircleIcon weight="fill"/>{usage.word}<small>{usage.meaning}</small></span>)}</div></div>
              <div className="story-result-actions"><button onClick={generate} disabled={storyMutation.isPending}><ArrowClockwiseIcon/> 같은 단어로 다시 만들기</button><button onClick={startWithNewWords}>새 단어 선택</button></div>
            </article>}
          </>}
    <Modal open={settingsOpen} title="스토리 설정" onClose={() => setSettingsOpen(false)} size="medium" footer={<><button className="ui-dialog-secondary" type="button" onClick={() => setSettingsOpen(false)}>취소</button><button className="ui-dialog-primary" type="button" onClick={applySettings}>설정 적용</button></>}>
      <div className="story-option-grid story-settings-fields"><OptionGroup variant="genre" label="장르 (Genre)" options={genres} value={draftGenre} setValue={setDraftGenre}/><OptionGroup variant="length" label="스토리 길이 (Length)" options={lengths} value={draftLength} setValue={setDraftLength}/><OptionGroup variant="difficulty" label="어휘 난이도 (CEFR)" options={difficulties} value={draftDifficulty} setValue={setDraftDifficulty}/></div>
    </Modal>
    <Modal open={selectorOpen} title="단어 선택" description={`같은 언어의 단어를 선택해주세요. (${draftSelectedIds.length}/30)`} onClose={closeSelector} size="large" footer={<><button className="ui-dialog-secondary" type="button" onClick={closeSelector}>취소</button><button className="ui-dialog-primary" type="button" onClick={applySelection}>선택한 {draftSelectedIds.length}개 적용</button></>}>
      <div className="story-selector">
        <div className="story-selector-languages" role="tablist" aria-label="언어별 필터"><button type="button" role="tab" aria-selected={languageFilter === 'all'} className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}>전체 언어</button>{availableLanguages.map(language => <button type="button" role="tab" aria-selected={languageFilter === language.code} className={languageFilter === language.code ? 'active' : ''} onClick={() => setLanguageFilter(language.code)} key={language.code}><span className="vocabulary-language-flag" aria-hidden="true">{languageFlags[language.code]}</span>{language.label}<small>{language.code.toUpperCase()}</small></button>)}</div>
        <label className="story-selector-search"><MagnifyingGlassIcon/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="단어나 뜻 검색" aria-label="스토리 단어 검색"/></label>
        <div className="story-selector-filters vocabulary-toolbar story-selector-filterbar">
          <div className="vocab-filters" role="tablist" aria-label="단어 필터">{([{ id: 'all', label: '전체' }, { id: 'favorite', label: '즐겨찾기' }, { id: 'incorrect', label: '오답단어' }] as const).map(filter => <button type="button" role="tab" aria-selected={wordFilter === filter.id} className={`vocabulary-filter-${filter.id}${wordFilter === filter.id ? ' active' : ''}`} onClick={() => setWordFilter(filter.id)} key={filter.id}>
            {filter.id === 'all' ? <ListBulletsIcon weight="bold" aria-hidden="true"/> : filter.id === 'favorite' ? <StarIcon weight="bold" aria-hidden="true"/> : <XCircleIcon weight="bold" aria-hidden="true"/>}
            <span className="vocabulary-filter-label">{filter.label} <b>{matchingWords.filter(word => matchesWordFilter(word, filter.id)).length}</b></span>
          </button>)}</div>
          <button type="button" className={`recommend${recommendSparkling ? ' sparkling' : ''}`} onClick={selectDraftRecommended} onAnimationEnd={() => setRecommendSparkling(false)}><SparkleIcon weight="fill"/> 추천</button>
        </div>
        <div className="story-word-grid story-selector-grid">{visibleWords.map(word => {
          const selected = draftSelectedIds.includes(word.vocabularyId)
          return <button type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => toggleDraftWord(word.vocabularyId)} key={word.vocabularyId}><span className="story-checkbox">{selected && <CheckIcon weight="bold"/>}</span><span><b>{word.word}<i className="story-language-badge">{word.languageCode.toUpperCase()}</i></b><small>{word.meaning}</small></span>{word.cefrLevel && <em className={`story-cefr-badge level-${word.cefrLevel.toLowerCase()}`} aria-label={`CEFR ${word.cefrLevel}`}>{word.cefrLevel}</em>}</button>
        })}</div>
        {!visibleWords.length && <p className="story-selector-empty">조건에 맞는 단어가 없어요.</p>}
      </div>
    </Modal>
    <AlertDialog open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message ?? ''} tone="warning" onClose={() => setAlert(undefined)}/>
  </div>
}

function OptionGroup<T extends string>({ label, options, value, setValue, variant }: { label: string; options: Array<{ value: T; label: string; description?: string }>; value: T; setValue: (value: T) => void; variant: 'genre' | 'length' | 'difficulty' }) {
  return <fieldset className={`story-setting-group story-setting-${variant}`}><legend>{label}</legend><div>{options.map(option => <button type="button" className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} onClick={() => setValue(option.value)} key={option.value}><span>{option.label}</span>{option.description && <small>{option.description}</small>}</button>)}</div></fieldset>
}
