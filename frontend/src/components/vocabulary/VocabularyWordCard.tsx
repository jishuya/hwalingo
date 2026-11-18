import { highlightVocabularyText } from '../../utils/highlightVocabularyText'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretDownIcon, CaretUpIcon, SparkleIcon, LightbulbIcon, PlantIcon, SpeakerHighIcon, TranslateIcon, StarIcon, MinusCircleIcon } from '@phosphor-icons/react'
import { getVocabularyReading, type Vocabulary } from '../../services/vocabulary'

export type VocabularyView = 'word' | 'meaning' | 'both'
interface Props {
  word: Vocabulary
  expanded: boolean
  view?: VocabularyView
  onToggle?: () => void
  onToggleFavorite?: () => void
  favoritePending?: boolean
  onDelete?: () => void
  deleteLabel?: string
  selection?: { checked: boolean; onChange: () => void }
  deletePending?: boolean
}

export default function VocabularyWordCard({word,expanded,view='both',onToggle,onToggleFavorite,favoritePending=false,onDelete,deletePending=false,deleteLabel,selection}: Props) {
  const [pronouncing,setPronouncing] = useState(false)
  const [translated,setTranslated] = useState(false)
  const reading = useQuery({
    queryKey: ['vocabulary-reading', word.vocabularyId, word.meaning, word.contextMeaning],
    queryFn: ({ signal }) => getVocabularyReading(word.vocabularyId, signal),
    enabled: expanded && (word.partOfSpeech == null || word.pronunciation == null),
    staleTime: Infinity,
    retry: false,
  })
  const partOfSpeech = word.partOfSpeech ?? reading.data?.partOfSpeech
  const pronunciation = word.pronunciation ?? reading.data?.pronunciation
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(()=>()=>clearTimeout(timer.current),[])
  const speak = (text:string,languageCode:string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = languageCode==='en'?'en-US':languageCode==='fr'?'fr-FR':languageCode==='de'?'de-DE':languageCode==='es'?'es-ES':languageCode
    window.speechSynthesis.speak(utterance)
  }
  const pronounceWord = () => {
    speak(word.word,word.languageCode)
    clearTimeout(timer.current)
    setPronouncing(true)
    timer.current=setTimeout(()=>setPronouncing(false),700)
  }
  const DetailCaret = expanded ? CaretUpIcon : CaretDownIcon
  const toggleLabel = `${word.word} 상세 정보 ${expanded ? '접기' : '펼치기'}`
  return <article className={`word-card compact-word-card${expanded ? ' expanded' : ''}`} onClick={event => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return
    if (window.getSelection()?.type === 'Range') return
    onToggle?.()
  }}>
    <div className={`compact-word-title${view === 'meaning' ? ' meaning-primary' : ''}`}>
      {selection && <input className="vocabulary-practice-checkbox" type="checkbox" aria-label={`${word.word} 연습 선택`} checked={selection.checked} onChange={selection.onChange}/>}
      {onDelete && <button type="button" className="vocabulary-remove-control" disabled={deletePending} aria-label={deleteLabel ?? `${word.word} 단어장에서 삭제`} onClick={onDelete}><MinusCircleIcon weight="fill" aria-hidden="true"/></button>}
      {onToggleFavorite && <button type="button" className={`favorite-star${word.isFavorite ? ' active' : ''}`} disabled={favoritePending} aria-label={word.isFavorite ? `${word.word} 즐겨찾기 해제` : `${word.word} 즐겨찾기 추가`} aria-pressed={word.isFavorite} onClick={onToggleFavorite}><StarIcon weight={word.isFavorite ? 'fill' : 'regular'} aria-hidden="true"/></button>}
      <h2><button type="button" className={`vocabulary-pronounce${pronouncing ? ' playing' : ''}`} aria-label={onToggle ? toggleLabel : `${word.word} 발음 듣기`} aria-expanded={onToggle ? expanded : undefined} onClick={onToggle ?? pronounceWord}>{view === 'meaning' ? word.meaning : word.word}</button></h2>
      {onToggle && <button type="button" className="vocabulary-card-toggle" aria-label={toggleLabel} aria-expanded={expanded} onClick={onToggle}><DetailCaret aria-hidden="true"/></button>}
    </div>
    {expanded && <div className="word-card-metadata">
      <div className="word-card-reading">
        <small className="word-card-level vocabulary-card-language">{word.languageCode.toUpperCase()}</small>
        {word.cefrLevel && <small className={`word-card-level level-${word.cefrLevel.toLowerCase()}`} aria-label={`CEFR ${word.cefrLevel}`}>{word.cefrLevel}</small>}
        {partOfSpeech && <span>{partOfSpeech}</span>}
        {pronunciation && <span>{pronunciation}</span>}
        {reading.isFetching && <span role="status">발음 정보 불러오는 중…</span>}
      </div>
      <button type="button" aria-label={`${word.word} 발음 듣기`} onClick={pronounceWord}><SpeakerHighIcon aria-hidden="true"/></button>
    </div>}
    {expanded && reading.isError && <button type="button" className="section-placeholder" onClick={() => void reading.refetch()}>품사·발음 다시 불러오기</button>}
    {!expanded && view === 'both' && <div className="vocabulary-meaning-row"><p className="compact-word-meaning vocabulary-full-width-meaning">
      {onToggle ? <button type="button" className="vocabulary-meaning-toggle" aria-expanded={expanded} aria-label={toggleLabel} onClick={onToggle}>{word.meaning}</button> : word.meaning}
    </p></div>}
    {expanded && (view === 'both' || word.contextMeaning) && <dl className="word-card-meanings with-context">
      {view === 'both' && <><dt>기본 뜻</dt><dd>{word.meaning}</dd></>}
      {word.contextMeaning && <><dt>문맥 뜻</dt><dd>{word.contextMeaning}</dd></>}
    </dl>}
                {expanded && <div className="word-details">{word.exampleSentence && <div className="vocabulary-example"><div className="word-detail-heading"><b><SparkleIcon weight="fill" aria-hidden="true"/>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence!, word.languageCode)}><SpeakerHighIcon/></button>{word.exampleTranslation && <button type="button" className={translated ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${translated ? '숨기기' : '보기'}`} aria-pressed={translated} onClick={() => setTranslated(previous=>!previous)}><TranslateIcon/></button>}</div></div><blockquote>{word.exampleTranslation ? <button type="button" className="vocabulary-example-toggle" aria-label={`${word.word} 예문 해석 ${translated ? '숨기기' : '보기'}`} aria-expanded={translated} onClick={() => setTranslated(previous=>!previous)}>{highlightVocabularyText(word.exampleSentence, word.word, 'vocabulary-example-highlight')}</button> : highlightVocabularyText(word.exampleSentence, word.word, 'vocabulary-example-highlight')}</blockquote>{translated && word.exampleTranslation && <p className="word-example-translation">{word.exampleTranslation}</p>}</div>}{word.etymology && <div className="vocabulary-etymology"><b><PlantIcon weight="fill"/> 어원</b><p>{word.etymology}</p></div>}{word.memoryTip && <div className="word-memory-tip"><b><LightbulbIcon weight="fill"/> AI 스마트 암기 팁</b><p>{highlightVocabularyText(word.memoryTip, word.word, 'vocabulary-tip-highlight', true)}</p></div>}</div>}
              </article>
}
