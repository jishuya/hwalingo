import { useEffect, useRef, useState } from 'react'
import { SparkleIcon, LightbulbIcon, PlantIcon, SpeakerHighIcon, TranslateIcon, StarIcon, MinusCircleIcon } from '@phosphor-icons/react'
import type { Vocabulary } from '../../services/vocabulary'

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

export default function VocabularyWordCard({word,expanded,view='both',onToggle,onToggleFavorite,favoritePending=false,onDelete,deletePending=false,deleteLabel,selection}: Props) {
  const [pronouncing,setPronouncing] = useState(false)
  const [translated,setTranslated] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(()=>()=>clearTimeout(timer.current),[])
  const speak = (text:string,languageCode:string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = languageCode==='en'?'en-US':languageCode==='fr'?'fr-FR':languageCode
    window.speechSynthesis.speak(utterance)
  }
  const pronounceWord = () => {
    speak(word.word,word.languageCode)
    clearTimeout(timer.current)
    setPronouncing(true)
    timer.current=setTimeout(()=>setPronouncing(false),700)
  }
  const reviewLabel = word.progress.totalAttempts > 0 && Number.isFinite(word.progress.nextReviewInDays)
    ? word.progress.isDue ? '복습 예정' : `${Math.max(1, word.progress.nextReviewInDays)}일 후 복습`
    : null
  return <article className={`word-card compact-word-card${expanded ? ' expanded' : ''}`} onClick={event => {
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
                onToggle?.()
              }}>
                <div className="compact-word-top">{selection&&<input className="vocabulary-practice-checkbox" type="checkbox" aria-label={`${word.word} 연습 선택`} checked={selection.checked} onChange={selection.onChange}/>}<div className={`compact-word-name${view === 'meaning' ? ' meaning-primary' : ''}`}><div className="vocabulary-word-summary"><div className="vocabulary-word-heading"><small className="word-language-badge">{word.languageCode.toUpperCase()}</small>{view !== 'meaning' && word.cefrLevel && <small className={`word-language-badge word-cefr-badge level-${word.cefrLevel.toLowerCase()}`}>{word.cefrLevel}</small>}</div></div></div><div className="compact-word-actions"><button type="button" className="compact-pronunciation" aria-label={`${word.word} 발음 듣기`} onClick={() => pronounceWord()}><SpeakerHighIcon/></button></div></div><div className={`compact-word-title${view === 'meaning' ? ' meaning-primary' : ''}`}>{onDelete && <button type="button" className="vocabulary-remove-control" disabled={deletePending} aria-label={deleteLabel??`${word.word} 단어장에서 삭제`} onClick={onDelete}><MinusCircleIcon weight="fill"/></button>}{onToggleFavorite && <button type="button" className={`favorite-star${word.isFavorite ? ' active' : ''}`} disabled={favoritePending} aria-label={word.isFavorite ? `${word.word} 즐겨찾기 해제` : `${word.word} 즐겨찾기 추가`} aria-pressed={word.isFavorite} onClick={() => onToggleFavorite()}><StarIcon weight={word.isFavorite ? 'fill' : 'regular'}/></button>}<h2><button type="button" className={`vocabulary-pronounce${pronouncing ? ' playing' : ''}`} aria-label={onToggle?`${word.word} 상세 정보 ${expanded ? '접기' : '보기'}`:`${word.word} 발음 듣기`} aria-expanded={onToggle?expanded:undefined} onClick={() => onToggle?onToggle():pronounceWord()}>{view === 'meaning' ? word.meaning : word.word}</button></h2></div><div className="vocabulary-meaning-row">{view === 'both' && <p className="compact-word-meaning vocabulary-full-width-meaning">{onToggle?<button type="button" className="vocabulary-meaning-toggle" aria-expanded={expanded} aria-label={`${word.word} 상세 정보 ${expanded ? '접기' : '보기'}`} onClick={() => onToggle?.()}>{word.meaning}</button>:word.meaning}</p>}{reviewLabel && <span className="vocabulary-review-label">{reviewLabel}</span>}</div>
                {expanded && word.contextMeaning && <div className="vocabulary-meaning-group">{ <div className="vocabulary-context"><b>문맥:</b><p>{word.contextMeaning}</p></div>}</div>}
                {expanded && <div className="word-details">{word.exampleSentence && <div className="vocabulary-example"><div className="word-detail-heading"><b><SparkleIcon weight="fill" aria-hidden="true"/>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence!, word.languageCode)}><SpeakerHighIcon/></button>{word.exampleTranslation && <button type="button" className={translated ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${translated ? '숨기기' : '보기'}`} aria-pressed={translated} onClick={() => setTranslated(previous=>!previous)}><TranslateIcon/></button>}</div></div><blockquote>{word.exampleTranslation ? <button type="button" className="vocabulary-example-toggle" aria-label={`${word.word} 예문 해석 ${translated ? '숨기기' : '보기'}`} aria-expanded={translated} onClick={() => setTranslated(previous=>!previous)}>{highlightVocabularyText(word.exampleSentence, word.word)}</button> : highlightVocabularyText(word.exampleSentence, word.word)}</blockquote>{translated && word.exampleTranslation && <p className="word-example-translation">{word.exampleTranslation}</p>}</div>}{word.etymology && <div className="vocabulary-etymology"><b><PlantIcon weight="fill"/> 어원</b><p>{word.etymology}</p></div>}{word.memoryTip && <div className="word-memory-tip"><b><LightbulbIcon weight="fill"/> AI 스마트 암기 팁</b><p>{highlightVocabularyText(word.memoryTip, word.word, true)}</p></div>}</div>}
              </article>
}
