import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon, BookOpenTextIcon, CheckCircleIcon, CheckIcon, MagnifyingGlassIcon, SpeakerHighIcon, SparkleIcon, XIcon } from '@phosphor-icons/react'
import { getVocabularies } from '../services/vocabulary'
import { createStory, type StoryDifficulty, type StoryGenre, type StoryLength } from '../services/story'

const genres: Array<{ value: StoryGenre; label: string }> = [{ value: 'daily', label: '일상' }, { value: 'adventure', label: '모험' }, { value: 'fantasy', label: '판타지' }, { value: 'mystery', label: '미스터리' }, { value: 'comedy', label: '코미디' }]
const lengths: Array<{ value: StoryLength; label: string }> = [{ value: 'short', label: '짧게' }, { value: 'medium', label: '보통' }, { value: 'long', label: '길게' }]
const difficulties: Array<{ value: StoryDifficulty; label: string }> = [{ value: 'easy', label: '쉬움' }, { value: 'normal', label: '보통' }, { value: 'hard', label: '어려움' }]

export default function StoryPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState<StoryGenre>('daily')
  const [length, setLength] = useState<StoryLength>('short')
  const [difficulty, setDifficulty] = useState<StoryDifficulty>('normal')
  const vocabulariesQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies() })
  const storyMutation = useMutation({ mutationFn: createStory, onSuccess: () => window.setTimeout(() => document.querySelector('.story-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) })
  const words = useMemo(() => vocabulariesQuery.data ?? [], [vocabulariesQuery.data])
  const selectedWords = words.filter(word => selectedIds.includes(word.vocabularyId))
  const selectedLanguage = selectedWords[0]?.languageCode
  const availableCount = words.filter(word => !selectedLanguage || word.languageCode === selectedLanguage).length
  const minimum = Math.min(3, availableCount)
  const visibleWords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return words.filter(word => !term || word.word.toLocaleLowerCase().includes(term) || word.meaning.toLocaleLowerCase().includes(term))
  }, [words, search])
  const toggleWord = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 10 ? [...current, id] : current)
  const recommend = () => {
    const source = [...words].sort((a, b) => Number(b.progress.isDue) - Number(a.progress.isDue) || a.progress.masteryLevel - b.progress.masteryLevel)
    const language = source[0]?.languageCode
    setSelectedIds(source.filter(word => word.languageCode === language).slice(0, 5).map(word => word.vocabularyId))
  }
  const generate = () => storyMutation.mutate({ vocabularyIds: selectedIds, genre, length, difficulty })
  const speak = (text: string) => {
    if (!selectedLanguage || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage
    window.speechSynthesis.speak(utterance)
  }

  return <div className="page story-page">
    <header className="page-title"><span className="page-title-icon"><SparkleIcon weight="fill"/></span><h1>AI 스토리텔링</h1></header>
    {vocabulariesQuery.isPending ? <div className="card story-state"><p>단어장을 불러오고 있어요.</p></div>
      : vocabulariesQuery.isError ? <div className="card story-state"><p>{vocabulariesQuery.error.message}</p><button className="primary" onClick={() => void vocabulariesQuery.refetch()}>다시 시도</button></div>
        : !words.length ? <div className="card story-state"><BookOpenTextIcon/><h2>스토리에 사용할 단어가 없어요</h2><p>문장 분석에서 단어를 저장하면 이곳에서 이야기로 복습할 수 있어요.</p></div>
          : <>
            <section className="card story-builder">
              <div className="story-section-heading"><div><span>STEP 1</span><h2>단어 선택</h2><p>같은 언어의 단어를 {minimum || 1}개 이상 선택해주세요.</p></div><strong>{selectedIds.length} / 10</strong></div>
              {selectedWords.length > 0 && <div className="selected-word-chips">{selectedWords.map(word => <button key={word.vocabularyId} onClick={() => toggleWord(word.vocabularyId)}>{word.word}<XIcon weight="bold"/></button>)}</div>}
              <div className="story-word-tools"><label><MagnifyingGlassIcon/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="단어나 뜻 검색" aria-label="스토리 단어 검색"/></label><button type="button" onClick={recommend}>복습 단어 추천</button></div>
              <div className="story-word-grid">{visibleWords.map(word => {
                const selected = selectedIds.includes(word.vocabularyId)
                const disabled = !selected && (selectedIds.length >= 10 || Boolean(selectedLanguage && word.languageCode !== selectedLanguage))
                return <button type="button" className={selected ? 'selected' : ''} disabled={disabled} aria-pressed={selected} onClick={() => toggleWord(word.vocabularyId)} key={word.vocabularyId}><span className="story-checkbox">{selected && <CheckIcon weight="bold"/>}</span><span><b>{word.word}</b><small>{word.meaning}</small></span><em>Lv.{word.progress.masteryLevel}</em></button>
              })}</div>
              <div className="story-options"><div className="story-section-heading"><div><span>STEP 2</span><h2>스토리 설정</h2></div></div><div className="story-option-grid"><OptionGroup label="장르" options={genres} value={genre} setValue={setGenre}/><OptionGroup label="길이" options={lengths} value={length} setValue={setLength}/><OptionGroup label="난이도" options={difficulties} value={difficulty} setValue={setDifficulty}/></div></div>
              <button className="primary story-generate" disabled={selectedIds.length < minimum || storyMutation.isPending} onClick={generate}><SparkleIcon weight="fill"/>{storyMutation.isPending ? '이야기를 만들고 있어요…' : `선택한 ${selectedIds.length}개 단어로 스토리 만들기`}</button>
              {selectedIds.length < minimum && <p className="story-helper">스토리를 만들려면 단어를 {minimum}개 이상 선택하세요.</p>}
              {storyMutation.isError && <p className="story-error" role="alert">{storyMutation.error.message} 선택한 단어는 그대로 유지됩니다.</p>}
            </section>
            {storyMutation.data && <article className="card story-card story-result">
              <div className="story-title"><div><span>AI STORY · {genres.find(item => item.value === genre)?.label}</span><h2>{storyMutation.data.title}</h2></div><button className="round" aria-label="스토리 전체 듣기" onClick={() => speak(storyMutation.data.story)}><SpeakerHighIcon/></button></div>
              <h3>STORY</h3><p>{storyMutation.data.segments.map((segment, index) => segment.vocabularyId ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</p>
              <hr/><h3>한국어 번역</h3><p className="translation">{storyMutation.data.translation}</p>
              <div className="story-usage"><h3>사용한 단어 {storyMutation.data.vocabularyUsages.length}/{selectedIds.length}</h3><div>{storyMutation.data.vocabularyUsages.map(usage => <span key={usage.vocabularyId}><CheckCircleIcon weight="fill"/>{usage.word}<small>{usage.meaning}</small></span>)}</div></div>
              <div className="story-result-actions"><button onClick={generate} disabled={storyMutation.isPending}><ArrowClockwiseIcon/> 같은 단어로 다시 만들기</button><button onClick={() => { setSelectedIds([]); storyMutation.reset(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>새 단어 선택</button></div>
            </article>}
          </>}
  </div>
}

function OptionGroup<T extends string>({ label, options, value, setValue }: { label: string; options: Array<{ value: T; label: string }>; value: T; setValue: (value: T) => void }) {
  return <fieldset><legend>{label}</legend><div>{options.map(option => <button type="button" className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} onClick={() => setValue(option.value)} key={option.value}>{option.label}</button>)}</div></fieldset>
}
