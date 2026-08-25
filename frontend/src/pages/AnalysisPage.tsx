import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowsClockwiseIcon,
  BookmarkSimpleIcon,
  BookOpenIcon,
  EyeIcon,
  EyeSlashIcon,
  LightbulbIcon,
  SpeakerHighIcon,
  TranslateIcon,
  TreeStructureIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import Icon from '../components/Icon'
import { analyzeSentence, languageOptions, type AnalysisRequest, type LanguageCode, type SentenceAnalysis } from '../services/analysis'

const initialText = '제 월급으로 그 차를 살 수 있을지 모르겠어요. 저는 그런데 차가 너무 갖고 싶어요.'
const speechLanguages: Record<LanguageCode, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR' }
const levelLabels = { beginner: '초급', intermediate: '중급', advanced: '고급' } as const

function languageLabel(code: LanguageCode) {
  return languageOptions.find(language => language.code === code)?.label ?? code.toUpperCase()
}

function highlightedSentence(analysis: SentenceAnalysis): ReactNode[] {
  const expressions = analysis.keyExpressions.map(item => item.text).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!expressions.length) return [analysis.targetSentence]
  const escaped = expressions.map(expression => expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const expressionSet = new Set(expressions.map(expression => expression.toLocaleLowerCase()))
  return analysis.targetSentence.split(pattern).filter(Boolean).map((part, index) => expressionSet.has(part.toLocaleLowerCase())
    ? <mark key={`${part}-${index}`}>{part}</mark>
    : <span key={`${part}-${index}`}>{part}</span>)
}

export default function AnalysisPage({ initialRequest }: { initialRequest?: AnalysisRequest }) {
  const fallbackRequest: AnalysisRequest = { text: initialText, sourceLanguage: 'ko', targetLanguage: 'en' }
  const request = initialRequest ?? fallbackRequest
  const [text, setText] = useState(request.text)
  const [analysis, setAnalysis] = useState<SentenceAnalysis>()
  const [isLoading, setIsLoading] = useState(Boolean(initialRequest))
  const [error, setError] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)
  const [showParaphrases, setShowParaphrases] = useState(false)
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set())
  const startedAutomatically = useRef(false)

  const runAnalysis = async (nextRequest: AnalysisRequest) => {
    setIsLoading(true)
    setError('')
    setAnalysis(undefined)
    setShowTranslation(false)
    setShowParaphrases(false)
    try {
      setAnalysis(await analyzeSentence(nextRequest))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI 분석을 완료하지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const submit = () => {
    const sentence = text.trim()
    if (!sentence || isLoading) return
    void runAnalysis({ ...request, text: sentence })
  }

  const speak = (content: string, language: LanguageCode) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = speechLanguages[language]
    window.speechSynthesis.speak(utterance)
  }

  const toggleSavedWord = (word: string) => {
    setSavedWords(current => {
      const next = new Set(current)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  useEffect(() => {
    if (!initialRequest || startedAutomatically.current) return
    startedAutomatically.current = true
    void runAnalysis(initialRequest)
  }, [initialRequest])

  return <div className="page analysis-page">
    <section className="card analysis-input-card">
      <div className="analysis-input-head">
        <h2>학습할 언어와 문구를 입력하세요</h2>
        <span className="analysis-language-pair">{languageLabel(request.sourceLanguage)} <b>→</b> {languageLabel(request.targetLanguage)}</span>
      </div>
      <textarea value={text} maxLength={500} onChange={(event) => setText(event.target.value)} />
      <div className="analysis-submit-row"><span>{text.length} / 500</span><button className="primary" disabled={isLoading || !text.trim()} onClick={submit}><Icon>✦</Icon> {isLoading ? 'AI 분석 중...' : 'AI 분석 시작'}</button></div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>

    {isLoading && <section className="analysis-loading" aria-live="polite" aria-label="AI 분석 중">
      <div className="analysis-loading-orb"><Icon>✦</Icon></div>
      <strong>문장을 학습하기 좋게 분석하고 있어요</strong>
      <span>자연스러운 표현과 핵심 어휘를 정리하는 중입니다.</span>
      <div className="analysis-loading-bar"><i /></div>
    </section>}

    {analysis && <div className="analysis-content">
      {analysis.warnings.map((warning, index) => <div className="analysis-warning" role="status" key={`${warning}-${index}`}><WarningCircleIcon weight="fill"/><span>{warning}</span></div>)}

      <section className="analysis-insight">
        <span><LightbulbIcon weight="fill" /></span>
        <div><h3>배경 지식</h3><p>{analysis.backgroundKnowledge}</p></div>
      </section>

      <section className="card analysis-result-card">
        <header className="analysis-sentence-head">
          <div><span className="analysis-eyebrow">자연스러운 {languageLabel(analysis.targetLanguage)} 표현</span><h1>{highlightedSentence(analysis)}</h1></div>
          <button className="analysis-round-button" aria-label="전체 문장 발음 듣기" onClick={() => speak(analysis.targetSentence, analysis.targetLanguage)}><SpeakerHighIcon weight="fill" /></button>
        </header>

        {analysis.keyExpressions.length > 0 && <div className="analysis-expression-list">{analysis.keyExpressions.map(expression => <span key={expression.text}><b>{expression.text}</b>{expression.meaning}</span>)}</div>}

        <div className="analysis-result-grid">
          <div className="analysis-main-column">
            <section className="analysis-section">
              <div className="analysis-section-title"><h3><TreeStructureIcon />직독직해 연습</h3></div>
              <div className="analysis-chunks">{analysis.chunks.map((chunk, index) => <div key={`${chunk.targetText}-${index}`}><b>{chunk.targetText}</b><span>{chunk.sourceMeaning}</span></div>)}</div>
            </section>

            <section className="analysis-section">
              <div className="analysis-section-title"><h3><TranslateIcon />완전한 해석</h3><button onClick={() => setShowTranslation(current => !current)}>{showTranslation ? <EyeSlashIcon /> : <EyeIcon />}{showTranslation ? '숨기기' : '보기'}</button></div>
              {showTranslation ? <div className="analysis-reveal-content">{analysis.naturalSourceMeaning}</div> : <button className="analysis-reveal-button" onClick={() => setShowTranslation(true)}>클릭하여 해석 보기</button>}
            </section>

            <section className="analysis-section">
              <div className="analysis-section-title"><h3><ArrowsClockwiseIcon />수준별 패러프레이징</h3><button onClick={() => setShowParaphrases(current => !current)}>{showParaphrases ? <EyeSlashIcon /> : <EyeIcon />}{showParaphrases ? '숨기기' : '보기'}</button></div>
              {showParaphrases ? <div className="analysis-paraphrases">{analysis.paraphrases.map(item => <article key={item.level}><span>{levelLabels[item.level]}</span><div><b>{item.targetText}</b><p>{item.sourceMeaning}</p></div><button aria-label={`${item.targetText} 발음 듣기`} onClick={() => speak(item.targetText, analysis.targetLanguage)}><SpeakerHighIcon /></button></article>)}</div> : <button className="analysis-reveal-button" onClick={() => setShowParaphrases(true)}>클릭하여 패러프레이징 보기</button>}
            </section>
          </div>

          <aside className="analysis-vocabulary">
            <h3><BookOpenIcon />핵심 어휘</h3>
            {analysis.vocabulary.map(word => <article className="analysis-vocab-card" key={word.word}>
              <button className={`analysis-bookmark${savedWords.has(word.word) ? ' saved' : ''}`} aria-label={`${word.word} ${savedWords.has(word.word) ? '저장 취소' : '단어장에 저장'}`} aria-pressed={savedWords.has(word.word)} onClick={() => toggleSavedWord(word.word)}><BookmarkSimpleIcon weight={savedWords.has(word.word) ? 'fill' : 'regular'} /></button>
              <div className="analysis-vocab-title"><h4>{word.word}</h4><span>{word.level}</span><button aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, analysis.targetLanguage)}><SpeakerHighIcon /></button></div>
              <p><b>{word.partOfSpeech}</b> {word.basicMeaning}</p>
              <p className="analysis-context-meaning">문맥: {word.contextualMeaning}</p>
              {(word.etymology || word.memoryTip) && <div className="analysis-word-notes">{word.etymology && <p><b>어원</b>{word.etymology}</p>}{word.memoryTip && <p className="analysis-memory-tip"><LightbulbIcon weight="fill"/><span><b>기억 팁</b>{word.memoryTip}</span></p>}</div>}
            </article>)}
          </aside>
        </div>
      </section>
    </div>}
  </div>
}
