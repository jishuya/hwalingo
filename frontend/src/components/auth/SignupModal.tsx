import { ArrowRight, Check, Eye, EyeSlash, X } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { signup, type AuthUser } from '../../services/auth'

interface SignupModalProps {
  onClose: () => void
  onComplete: (user: AuthUser) => void
}

export default function SignupModal({ onClose, onComplete }: SignupModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setSubmitting(true)
    try {
      const result = await signup(email, password, displayName)
      onComplete(result.user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '회원가입을 처리하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return <div className="signup-backdrop" onMouseDown={closeFromBackdrop}>
    <section className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-title">
      <header className="signup-modal-head">
        <div><h2 id="signup-title">회원가입</h2><p>Hwalingo에 오신 것을 환영합니다!</p></div>
        <button type="button" onClick={onClose} aria-label="회원가입 닫기"><X/></button>
      </header>

      <form onSubmit={submit}>
        <div className="signup-modal-body">
          <label><span>이름</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} type="text" minLength={2} maxLength={100} autoComplete="name" placeholder="홍길동" autoFocus required/></label>
          <label><span>이메일 주소</span><input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="example@email.com" required/></label>
          <label><span>비밀번호</span><div className="signup-password"><input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} autoComplete="new-password" placeholder="8자 이상 입력해주세요" required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? <EyeSlash/> : <Eye/>}</button></div></label>
          <label><span>비밀번호 확인</span><input value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} autoComplete="new-password" placeholder="비밀번호를 다시 입력해주세요" required/></label>
          <label className="signup-terms"><input checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} type="checkbox" required/><span className="signup-check"><Check weight="bold"/></span><span>약관 및 개인정보 처리방침에 동의합니다 <b>*</b></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </div>
        <footer className="signup-modal-footer"><button type="submit" disabled={submitting || !acceptedTerms}>{submitting ? '가입 처리 중...' : '가입하기'}<ArrowRight weight="bold"/></button></footer>
      </form>
    </section>
  </div>
}
