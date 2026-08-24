import { ArrowRight, BookOpenText, ChatCircle, Check, EnvelopeSimple, Eye, EyeSlash, LockKey, Sparkle, TrendUp } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import SignupModal from '../components/auth/SignupModal'
import mascot from '../assets/hwalangi-upper-body.png'
import wordmark from '../assets/wordmarks/hwalingo-wordmark-01-rounded.png'
import { login, type AuthUser } from '../services/auth'

export default function LoginPage({ done }: { done: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await login(email, password, rememberMe)
      done(result.user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '요청을 처리하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return <><main className="auth-page">
    <section className="auth-showcase" aria-label="Hwalingo 소개">
      <div className="auth-showcase-copy">
        <span className="auth-eyebrow"><Sparkle weight="fill"/> 매일 조금씩, 분명하게</span>
        <h1>영어 문장이<br/><em>내 것이 되는 순간.</em></h1>
        <p>문장을 이해하고, 단어를 모으고, 나만의 이야기로 기억하세요.</p>
        <div className="auth-benefits">
          <span><Check weight="bold"/> 문장 구조를 한눈에</span>
          <span><Check weight="bold"/> 단어는 오래 기억하게</span>
        </div>
      </div>
      <div className="auth-preview" aria-hidden="true">
        <div className="preview-head"><span><BookOpenText weight="duotone"/></span><div><small>오늘의 표현</small><strong>Small steps add up.</strong></div></div>
        <div className="preview-meaning"><span>small steps</span><i>작은 걸음들이</i><span>add up</span><i>쌓이다</i></div>
        <div className="preview-progress"><span><TrendUp weight="bold"/> 이번 주 학습</span><strong>82%</strong></div>
      </div>
      <small className="auth-copyright">© 2026 Hwalingo</small>
    </section>

    <section className="auth-form-side">
      <div className="auth-form-wrap">
        <header className="auth-heading">
          <span className="auth-heading-mascot"><img src={mascot} alt="Hwalingo 캐릭터"/></span>
          <h1 className="auth-wordmark"><img src={wordmark} alt="Hwalingo"/></h1>
        </header>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field"><span className="auth-sr-only">이메일</span><EnvelopeSimple className="auth-field-icon"/><input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="이메일 주소" required/></label>
          <label className="auth-field auth-password"><span className="auth-sr-only">비밀번호</span><LockKey className="auth-field-icon"/><input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} autoComplete="current-password" placeholder="비밀번호 (8자 이상)" required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? <EyeSlash/> : <Eye/>}</button></label>

          <div className="auth-options"><label className="auth-check"><input checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} type="checkbox"/><span><Check weight="bold"/></span>로그인 유지</label><button type="button" disabled>비밀번호를 잊으셨나요?</button></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? '잠시만 기다려주세요' : '로그인하기'}<ArrowRight weight="bold"/></button>
        </form>

        <p className="auth-switch">처음 방문하셨나요? <button type="button" onClick={() => setSignupOpen(true)}>회원가입</button></p>
        <div className="auth-divider"><span>간편 로그인</span></div>
        <div className="auth-socials">
          <button type="button" className="auth-social-google" onClick={() => setError('Google 로그인은 준비 중입니다.')}><b>G</b><span>Google</span></button>
          <button type="button" className="auth-social-kakao" onClick={() => setError('카카오 로그인은 준비 중입니다.')}><ChatCircle weight="fill"/><span>Kakao</span></button>
        </div>
      </div>
    </section>
  </main>{signupOpen && <SignupModal onClose={() => setSignupOpen(false)} onComplete={done}/>}</>
}
