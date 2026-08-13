import { useState } from 'react'

const questions = [
  { word: 'reserve', level: '중', example: "I'd like to reserve a table for two.", answer: '예약하다', origin: '라틴어 reservare에서 유래해 ‘따로 보관하다’라는 뜻을 가집니다.', tip: '자리를 미리 따로 보관해 둔다고 연상해 보세요.' },
  { word: 'salary', level: '중', example: 'She receives her salary at the end of every month.', answer: '급여', origin: '라틴어 salarium에서 유래한 단어입니다.', tip: 'Salt와 어원이 같다는 점을 기억하세요.' },
  { word: 'afford', level: '중', example: "I can't afford to buy a new car right now.", answer: '여유가 되다', origin: '고대 영어 geforthian에서 유래했습니다.', tip: '무언가를 살 금전적인 여유가 있다고 기억하세요.' },
]

export default function QuizPage() {
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [translation, setTranslation] = useState(false)
  const [hint, setHint] = useState<'origin' | 'tip' | null>(null)
  const question = questions[index]

  const next = (result: string) => {
    setMessage(result)
    window.setTimeout(() => {
      setIndex(current => (current + 1) % questions.length)
      setInput(''); setMessage(''); setHint(null); setTranslation(false)
    }, 700)
  }
  const check = () => next(input.trim().includes(question.answer) ? '정답이에요!' : `정답은 “${question.answer}”입니다.`)

  return <div className="quiz-page page">
    <div className="quiz-progress"><div><span>진행률</span><b>{index + 1}/{questions.length}</b></div><div className="progress-track"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }}/></div></div>
    <section className="quiz-word-card card"><span className="level">Level: {question.level}</span><div className="quiz-word"><h1>{question.word}</h1><button className="round" aria-label="발음 듣기">🔊</button></div><div className="quiz-example"><div><span>EXAMPLE</span><button onClick={() => setTranslation(value => !value)}>◎ 해석</button></div><p>{question.example}</p>{translation && <small>예문 속 핵심 단어의 뜻을 문맥과 함께 확인해 보세요.</small>}</div></section>
    <div className="quiz-chips"><button onClick={() => setHint('origin')}>▤ 어원 힌트</button><button className="tip-chip" onClick={() => setHint('tip')}>💡 암기 팁</button><button>◉ AI 심화</button><button>▧ AI 그림</button></div>
    {hint && <div className="quiz-hint">{hint === 'origin' ? question.origin : question.tip}</div>}
    <div className="answer-box"><span>●</span><input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && check()} placeholder="뜻을 입력하세요..."/><button onClick={check}>확인</button></div>
    {message && <p className="quiz-message">{message}</p>}
    <div className="quiz-actions"><button onClick={() => setMessage(`정답은 “${question.answer}”입니다.`)}>◉ 정답 확인 (머리로 생각)</button><button onClick={() => next(`정답은 “${question.answer}”입니다.`)}>모르겠어요 (패스) ↻</button></div>
  </div>
}
