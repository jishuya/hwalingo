import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookmarkSimpleIcon, CaretDownIcon, CaretUpIcon, LightbulbIcon, PlantIcon, SparkleIcon, SpeakerHighIcon, TranslateIcon } from '@phosphor-icons/react'
import { sentenceVocabularyDetailQuery, type LanguageCode, type VocabularyAnalysis, type VocabularySummary } from '../../services/analysis'
import { highlightVocabularyText } from '../../utils/highlightVocabularyText'

interface Props {
  summary: VocabularySummary
  sentence: { inputText: string; learningSentence: string }
  inputLanguage: LanguageCode
  learningLanguage: LanguageCode
  previewDetail?: VocabularyAnalysis
  saved: boolean
  saving: boolean
  onSaveToggle: (detail?: VocabularyAnalysis) => void
  speak: (text: string, language: LanguageCode) => void
}

export default function AnalysisVocabularyCard({ summary, sentence, inputLanguage, learningLanguage, previewDetail, saved, saving, onSaveToggle, speak }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [exampleTranslationOpen, setExampleTranslationOpen] = useState(false)
  const detail = useQuery({
    ...sentenceVocabularyDetailQuery(inputLanguage, learningLanguage, sentence, summary),
    enabled: expanded && !previewDetail,
  })
  const word = previewDetail ?? detail.data
  const DetailCaret = expanded ? CaretUpIcon : CaretDownIcon
  const toggleLabel = `${summary.word} 상세 정보 ${expanded ? '접기' : '펼치기'}`
  const toggleDetails = () => setExpanded(open => !open)
  return <article className="sentence-vocab-card" onClick={event => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return
    if (window.getSelection()?.type === 'Range') return
    toggleDetails()
  }}>
    <button type="button" className={saved ? 'saved' : ''} disabled={saving} aria-label={saved ? '단어 저장 취소' : '단어장에 저장'} aria-pressed={saved} onClick={() => onSaveToggle(word)}><BookmarkSimpleIcon weight={saved ? 'fill' : 'regular'} aria-hidden="true"/></button>
    <div className="sentence-vocab-title">
      <h4 className="analysis-vocabulary-label">{summary.word}</h4>
      <button type="button" className="analysis-vocabulary-toggle" aria-label={toggleLabel} aria-expanded={expanded} onClick={toggleDetails}><DetailCaret aria-hidden="true"/></button>
    </div>
    <div className="analysis-vocabulary-body">
      {expanded && <div className="analysis-vocabulary-metadata word-card-metadata">
        <div className="analysis-vocabulary-reading word-card-reading">
          <small className={`word-card-level level-${summary.level.toLowerCase()}`} aria-label={`CEFR ${summary.level}`}>{summary.level}</small>
          {word && <span>{word.partOfSpeech}</span>}
          {word?.pronunciation && <span>{word.pronunciation}</span>}
        </div>
        {word && <button type="button" aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, learningLanguage)}><SpeakerHighIcon aria-hidden="true"/></button>}
      </div>}
      <dl className={`analysis-vocabulary-meanings word-card-meanings${expanded && word ? ' with-context' : ''}`}>
        <dt hidden={!expanded || !word}>기본 뜻</dt>
        <dd><button type="button" className="analysis-vocabulary-summary-meaning" aria-label={toggleLabel} aria-expanded={expanded} onClick={toggleDetails}>{summary.basicMeaning}</button></dd>
        {expanded && word && <><dt>문맥 뜻</dt><dd>{word.contextualMeaning}</dd></>}
      </dl>
    </div>
    {expanded && <div className="analysis-word-details">
      {detail.isFetching && !word && <p role="status">상세 어휘를 정리하고 있어요…</p>}
      {!previewDetail && detail.isError && <div role="alert"><p>{detail.error.message}</p><button type="button" className="section-placeholder" onClick={() => void detail.refetch()}>다시 시도</button></div>}
      {word && <>
        {word.exampleSentence && <div className="analysis-word-example"><div className="analysis-word-detail-heading"><b><SparkleIcon weight="fill" aria-hidden="true"/>예문</b><div><button type="button" aria-label={`${word.word} 예문 듣기`} onClick={() => speak(word.exampleSentence, learningLanguage)}><SpeakerHighIcon/></button>{word.exampleMeaning && <button type="button" className={exampleTranslationOpen ? 'active' : ''} aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-pressed={exampleTranslationOpen} onClick={() => setExampleTranslationOpen(open => !open)}><TranslateIcon/></button>}</div></div><blockquote>{word.exampleMeaning ? <button type="button" className="analysis-example-toggle" aria-label={`${word.word} 예문 해석 ${exampleTranslationOpen ? '숨기기' : '보기'}`} aria-expanded={exampleTranslationOpen} onClick={() => setExampleTranslationOpen(open => !open)}>{highlightVocabularyText(word.exampleSentence, word.word, 'analysis-example-highlight')}</button> : highlightVocabularyText(word.exampleSentence, word.word, 'analysis-example-highlight')}</blockquote>{exampleTranslationOpen && word.exampleMeaning && <p className="analysis-word-example-translation">{word.exampleMeaning}</p>}</div>}
        {word.etymology && <div className="analysis-word-etymology"><b><PlantIcon weight="fill" aria-hidden="true"/>어원</b><p>{word.etymology}</p></div>}
        {word.memoryTip && <div className="analysis-word-memory-tip"><b><LightbulbIcon weight="fill" aria-hidden="true"/>AI 스마트 암기 팁</b><p>{highlightVocabularyText(word.memoryTip, word.word, 'analysis-tip-highlight', true)}</p></div>}
      </>}
    </div>}
  </article>
}
