import { ArrowRight, Check, EnvelopeSimple, Eye, EyeSlash, LockKey, ShieldCheckIcon } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import SignupModal from '../components/auth/SignupModal'
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal'
import AnalysisPreview from '../components/study/AnalysisPreview'
import { AlertDialog } from '../components/ui/Dialog'
import logo from '../assets/hwalingo_logo.png'
import wordmark from '../assets/wordmarks/hwalingo-wordmark-01-rounded.png'
import { login, type AuthUser } from '../services/auth'

const lastLoginEmailKey = 'hwalingo:last-login-email'

export default function LoginPage({ done }: { done: (user: AuthUser) => void }) {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(lastLoginEmailKey) ?? ''
    } catch {
      return ''
    }
  })
  const [rememberEmail, setRememberEmail] = useState(Boolean(email))
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signupOpen, setSignupOpen] = useState(() => new URLSearchParams(window.location.search).get('signup') === '1')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [error, setError] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.body.classList.add('auth-screen')
    return () => document.body.classList.remove('auth-screen')
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setPasswordChanged(false)
    setSubmitting(true)

    try {
      const result = await login(email, password)
      if (rememberEmail) {
        try {
          localStorage.setItem(lastLoginEmailKey, result.user.email)
        } catch {
          // Login can complete when browser storage is unavailable.
        }
      }
      done(result.user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '요청을 처리하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const changeRememberEmail = (checked: boolean) => {
    setRememberEmail(checked)
    if (!checked) {
      try {
        localStorage.removeItem(lastLoginEmailKey)
      } catch {
        // The checkbox remains usable when browser storage is unavailable.
      }
    }
  }

  return <><main className="auth-page auth-page-single">
    <section className="auth-form-side">
      <div className="auth-form-wrap">
        <header className="auth-heading">
          <span className="auth-heading-mascot"><img src={logo} alt="Hwalingo 로고"/></span>
          <h1 className="auth-wordmark"><img src={wordmark} alt="Hwalingo"/></h1>
          <p className="auth-tagline">매일 조금씩, <span>함께 배우는 즐거움</span></p>
        </header>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field"><span className="auth-sr-only">이메일</span><EnvelopeSimple className="auth-field-icon"/><input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="이메일 주소" required/></label>
          <label className="auth-field auth-password"><span className="auth-sr-only">비밀번호</span><LockKey className="auth-field-icon"/><input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} autoComplete="current-password" placeholder="비밀번호 (8자 이상)" required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? <EyeSlash/> : <Eye/>}</button></label>

          <div className="auth-options">
            <label className="auth-check"><input checked={rememberEmail} onChange={event => changeRememberEmail(event.target.checked)} disabled={submitting} type="checkbox"/><span><Check weight="bold"/></span>아이디 기억하기</label>
            <button type="button" onClick={() => { setError(''); setForgotPasswordOpen(true) }}>비밀번호를 잊으셨나요?</button>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? '잠시만 기다려주세요' : '로그인하기'}<ArrowRight weight="bold"/></button>
        </form>

        <p className="auth-switch">처음 방문하셨나요? <button type="button" onClick={() => setSignupOpen(true)}>회원가입</button></p>
        <p className="auth-switch">
          <a className="auth-privacy-link" href="/privacy.html">
            <ShieldCheckIcon weight="duotone" aria-hidden="true"/>
            개인정보처리방침
          </a>
        </p>
        <p className="auth-switch"><button className="auth-preview-button" type="button" onClick={() => setPreviewOpen(true)}>가입 없이 체험하기</button></p>

      </div>
    </section>
  </main>
    {previewOpen && <AnalysisPreview onClose={() => setPreviewOpen(false)} onSignup={() => {
      setPreviewOpen(false)
      setSignupOpen(true)
    }}/>}
    {signupOpen && <SignupModal onClose={() => setSignupOpen(false)} onComplete={done}/>} {forgotPasswordOpen && <ForgotPasswordModal initialEmail={email} onClose={() => setForgotPasswordOpen(false)} onComplete={() => { setForgotPasswordOpen(false); setPassword(''); setPasswordChanged(true) }}/>}<AlertDialog open={passwordChanged} title="비밀번호 변경 완료" message={<>비밀번호가 변경되었습니다.<br/>새 비밀번호로 로그인해주세요.</>} tone="success" onClose={() => setPasswordChanged(false)}/></>
}
