import { useState } from 'react'

export default function StoryPage() {
  const [made, setMade] = useState(true)
  return <div className="page story-page"><section className="story-hero"><div className="sparkles">✦</div><h1>나만의 단어로 스토리 만들기</h1><p>저장한 단어들이 모두 포함된 짧고 재미있는 스토리를 AI가 생성합니다.<br/>문맥 속에서 단어를 자연스럽게 복습해보세요.</p><button className="primary" onClick={() => setMade(true)}>✦ 짧은 스토리 생성하기</button></section>{made && <section className="card story-card"><div className="story-title"><div><span>AI STORY</span><h2>The Affordable Dragon</h2></div><button className="round">🔊</button></div><h3>English Story</h3><p>After receiving his first <mark>salary</mark>, Kevin had a strong <mark>desire</mark> to <mark>possess</mark> a pet dragon. He quickly realized he couldn't <mark>afford</mark> the fire insurance, so he bought a grumpy goldfish instead. Now, he tells everyone his dragon is just in a very small, watery disguise.</p><hr/><h3>Korean Translation</h3><p className="translation">첫 월급을 받은 후, 케빈은 애완용 용을 소유하고 싶은 강한 욕망이 생겼습니다. 그는 곧 화재 보험료를 감당할 수 없다는 것을 깨닫고 대신 심술궂은 금붕어를 한 마리 샀습니다.</p></section>}</div>
}
