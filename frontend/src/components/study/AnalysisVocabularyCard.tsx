import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretDownIcon, CaretUpIcon, LightbulbIcon, PlantIcon, SparkleIcon, SpeakerHighIcon, StarIcon, TranslateIcon } from '@phosphor-icons/react'
import { getSentenceVocabularyDetail, type LanguageCode, type VocabularyAnalysis, type VocabularySummary } from '../../services/analysis'
import { highlightVocabularyText } from '../../utils/highlightVocabularyText'

interface Props {
  summary: VocabularySummary
  sentence: { inputText: string; learningSentence: string }
  inputLanguage: LanguageCode
  learningLanguage: LanguageCode
  saved: boolean
  saving: boolean
  onSaveToggle: (detail?: VocabularyAnalysis) => void
  speak: (text: string, language: LanguageCode) => void
}

export default function AnalysisVocabularyCard({ summary, sentence, inputLanguage, learningLanguage, saved, saving, onSaveToggle, speak }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [exampleTranslationOpen, setExampleTranslationOpen] = useState(false)
  const detail = useQuery({
    queryKey: ['analysis-vocabulary-detail', inputLanguage, learningLanguage, sentence.inputText, sentence.learningSentence, summary],
    queryFn: ({ signal }) => getSentenceVocabularyDetail({
      inputLanguage, learningLanguage, target: summary,
      sentences: [{ inputText: sentence.inputText, learningSentence: sentence.learningSentence }],
    }, signal),
    enabled: expanded,
    staleTime: Infinity,
    retry: false,
  })
  const word = detail.data
  return <article className="sentence-vocab-card">
    <button type="button" className={saved ? 'saved' : ''} disabled={saving} aria-label={saved ? '단어 저장 취소' : '단어장에 저장'} aria-pressed={saved} onClick={() => onSaveToggle(word)}><StarIcon weight={saved ? 'fill' : 'regular'} aria-hidden="true"/></button>
    <div className="sentence-vocab-title">
      <h4>{summary.word}</h4>
      <button type="button" aria-label={`${summary.word} 상세 정보 ${expanded ? '접기' : '펼치기'}`} aria-expanded={expanded} onClick={() => setExpanded(open => !open)}>
        {expanded ? <CaretUpIcon aria-hidden="true"/> : <CaretDownIcon aria-hidden="true"/>}
      </button>
    </div>
    <p className="analysis-vocabulary-summary-meaning">{summary.basicMeaning}</p>
    {expanded && <div className="analysis-word-details">
      {detail.isFetching && !word && <p role="status">상세 어휘를 정리하고 있어요…</p>}
      {detail.isError && <div role="alert"><p>{detail.error.message}</p><button type="button" className="section-placeholder" onClick={() => void detail.refetch()}>다시 시도</button></div>}
      {word && <>
        <div className="analysis-word-detail-heading">
          <b>{word.partOfSpeech} · {word.level}{word.pronunciation && ` · ${word.pronunciation}`}</b>
          <div><button type="button" aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, learningLanguage)}><SpeakerHighIcon/></button></div>
        </div>
        <p><b>문맥:</b> {word.contextualMeaning}</p>
        {word.exampleSentence && <div className="analysis-word-example"><div className="analysis-word-detail-heading"><b><SparkleIcon weight="fill" aria-hidden="true"/>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence, learningLanguage)}><SpeakerHighIcon/></button>{word.exampleMeaning && <button type="button" className={exampleTranslationOpen ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-pressed={exampleTranslationOpen} onClick={() => setExampleTranslationOpen(open => !open)}><TranslateIcon/></button>}</div></div><blockquote>{word.exampleMeaning ? <button type="button" className="analysis-example-toggle" aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-expanded={exampleTranslationOpen} onClick={() => setExampleTranslationOpen(open => !open)}>{highlightVocabularyText(word.exampleSentence, word.word, 'analysis-example-highlight')}</button> : highlightVocabularyText(word.exampleSentence, word.word, 'analysis-example-highlight')}</blockquote>{exampleTranslationOpen && word.exampleMeaning && <p className="analysis-word-example-translation">{word.exampleMeaning}</p>}</div>}
        {word.etymology && <div className="analysis-word-etymology"><b><PlantIcon weight="fill" aria-hidden="true"/>어원</b><p>{word.etymology}</p></div>}
        {word.memoryTip && <div className="analysis-word-memory-tip"><b><LightbulbIcon weight="fill" aria-hidden="true"/>AI 스마트 암기 팁</b><p>{highlightVocabularyText(word.memoryTip, word.word, 'analysis-tip-highlight', true)}</p></div>}
      </>}
    </div>}
  </article>
}
