import { useState } from 'react'
import Icon from '../components/Icon'

export default function StudyPage({ analyze }: { analyze: () => void }) {
  const [text, setText] = useState('')
  return <div className="page narrow"><section className="card input-card"><div className="section-row"><h1>학습할 언어와 문구를 입력하세요</h1><select aria-label="학습 언어"><option>영어</option><option>한국어</option><option>일본어</option><option>중국어</option></select></div><textarea value={text} onChange={event => setText(event.target.value)} placeholder="학습하고 싶은 문장이나 문구를 입력해 주세요."/><div className="input-footer"><span>{text.length} / 500</span><button className="primary" onClick={analyze}><Icon>✦</Icon> AI 분석 시작</button></div></section><div className="empty-state"><span>✎</span><h2>어떤 문장이든 학습할 수 있어요</h2><p>일상에서 궁금했던 문장을 입력하면<br/>AI가 자연스러운 표현과 핵심 어휘를 분석해 드립니다.</p></div></div>
}
