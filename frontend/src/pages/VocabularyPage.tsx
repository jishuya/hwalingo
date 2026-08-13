import { useState } from 'react'
import Icon from '../components/Icon'
import { words } from '../data/words'

export default function VocabularyPage() {
  const [saved, setSaved] = useState(words)
  return <div className="page"><section className="card vocab-head"><h1><Icon>◆</Icon> 총 {saved.length}개의 단어</h1><div><button>⇩ 엑셀 다운로드</button><button className="primary">✓ 퀴즈 시작하기</button></div></section><div className="word-grid">{saved.map(word=><article className="card word-card" key={word.word}><div className="word-title"><div><h2>{word.word}</h2><span>{word.level}</span><button aria-label="발음 듣기">🔊</button></div><button className="delete" onClick={() => setSaved(current => current.filter(item => item.word !== word.word))}>×</button></div><dl><dt>기본</dt><dd>{word.base}</dd><dt>문맥</dt><dd>{word.context}</dd></dl><p className="tip">💡 {word.tip}</p><button className="example">✦ AI 예문 만들기</button><blockquote>{word.example}</blockquote></article>)}</div></div>
}
