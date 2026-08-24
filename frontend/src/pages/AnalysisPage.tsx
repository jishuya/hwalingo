import { useState } from 'react'
import Icon from '../components/Icon'
import { analyzeSentence, type SentenceAnalysis } from '../services/analysis'

const initialText = '제 월급으로 그 차를 살 수 있을지 모르겠어요. 저는 그런데 차가 너무 갖고 싶어요.'

export default function AnalysisPage() {
  const [text, setText] = useState(initialText)
  const [analysis, setAnalysis] = useState<SentenceAnalysis>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!text.trim() || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      setAnalysis(await analyzeSentence(text.trim()))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI 분석을 완료하지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return <div className="page analysis-page">
    <section className="card mini-input">
      <div className="section-row"><h2>학습할 언어와 문구를 입력하세요</h2><select aria-label="학습 언어"><option>영어</option></select></div>
      <textarea value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} />
      <button className="primary" disabled={isLoading || !text.trim()} onClick={submit}><Icon>✦</Icon> {isLoading ? 'AI 분석 중...' : 'AI 분석 시작'}</button>
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>

    {analysis && <>
      <section className="insight"><Icon>💡</Icon><div><b>배경 지식</b><p>{analysis.backgroundKnowledge}</p></div></section>
      <section className="card result">
        <div className="sentence"><h1>{analysis.sentence}</h1></div>
        <div className="analysis-grid"><div>
          <h3>⑂ 직독직해 연습</h3>
          <div className="chunks">{analysis.chunks.map((chunk, index) => <span key={`${chunk.english}-${index}`}>{chunk.english}<small>{chunk.korean}</small></span>)}</div>
          <div className="reveal"><b>▣ 완전한 해석</b><p>{analysis.translation}</p></div>
          <div className="reveal"><b>↻ 수준별 패러프레이징</b>{analysis.paraphrases.map((item) => <p key={item.level}><strong>{item.level}</strong> {item.sentence}</p>)}</div>
        </div><aside><h3>핵심 어휘</h3>{analysis.vocabulary.map((word) => <div className="key-word" key={word.word}><b>{word.word}</b><span>{word.level}</span><p>{word.meaning}</p></div>)}</aside></div>
      </section>
    </>}
  </div>
}
