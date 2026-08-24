import { ArrowRight, Check, Eye, EyeSlash, X } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { signup, type AuthUser } from '../../services/auth'

interface SignupModalProps {
  onClose: () => void
  onComplete: (user: AuthUser) => void
}

type SignupField = 'displayName' | 'email' | 'password' | 'confirmPassword' | 'terms'
type SignupErrors = Partial<Record<SignupField, string>>

function validateDisplayName(value: string): string | undefined {
  if (!value) return '이름을 입력해주세요.'
  if (/\s/.test(value)) return '이름에는 띄어쓰기를 사용할 수 없습니다.'
  if (value.length < 2) return '이름은 2자 이상이어야 합니다.'
  if (value.length > 20) return '이름은 20자 이하로 입력해주세요.'
  if (!/^[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]+$/.test(value)) return '이름에는 한글과 영문만 사용할 수 있습니다.'
}

function validateEmail(value: string): string | undefined {
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value)) return '이메일 주소에는 한글을 사용할 수 없습니다.'
  if (!/^\S+@\S+\.\S+$/.test(value.trim())) return '@와 도메인을 포함한 이메일 주소를 입력해주세요.'
}

function validatePassword(value: string): string | undefined {
  if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (value.length > 72) return '비밀번호는 72자 이하로 입력해주세요.'
  if (!/[^A-Za-z0-9\s]/.test(value)) return '특수문자를 최소 1개 포함해주세요.'
}

export default function SignupModal({ onClose, onComplete }: SignupModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({})
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
    const nextErrors: SignupErrors = {}

    const displayNameError = validateDisplayName(displayName)
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    if (displayNameError) nextErrors.displayName = displayNameError
    if (emailError) nextErrors.email = emailError
    if (passwordError) nextErrors.password = passwordError
    if (!confirmPassword) nextErrors.confirmPassword = '비밀번호를 한 번 더 입력해주세요.'
    else if (password !== confirmPassword) nextErrors.confirmPassword = '입력한 비밀번호가 서로 일치하지 않습니다.'
    if (!acceptedTerms) nextErrors.terms = '가입하려면 약관에 동의해주세요.'

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
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

  const clearFieldError = (field: SignupField) => {
    setFieldErrors(current => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validateField = (field: SignupField, message: string | undefined) => {
    setFieldErrors(current => {
      const next = { ...current }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  return <div className="signup-backdrop" onMouseDown={closeFromBackdrop}>
    <section className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-title">
      <header className="signup-modal-head">
        <div><h2 id="signup-title">회원가입</h2><p>Hwalingo에 오신 것을 환영합니다!</p></div>
        <button type="button" onClick={onClose} aria-label="회원가입 닫기"><X/></button>
      </header>

      <form onSubmit={submit} noValidate>
        <div className="signup-modal-body">
          <label><span>이름</span><input value={displayName} onChange={event => { setDisplayName(event.target.value); clearFieldError('displayName') }} onBlur={() => validateField('displayName', validateDisplayName(displayName))} type="text" minLength={2} maxLength={20} autoComplete="name" placeholder="홍길동" aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? 'signup-name-error' : undefined} autoFocus required/>{fieldErrors.displayName && <small className="signup-field-error" id="signup-name-error">{fieldErrors.displayName}</small>}</label>
          <label><span>이메일 주소</span><input value={email} onChange={event => { setEmail(event.target.value); clearFieldError('email') }} onBlur={() => validateField('email', validateEmail(email))} type="email" autoComplete="email" placeholder="example@email.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined} required/>{fieldErrors.email && <small className="signup-field-error" id="signup-email-error">{fieldErrors.email}</small>}</label>
          <label><span>비밀번호</span><div className="signup-password"><input value={password} onChange={event => { setPassword(event.target.value); clearFieldError('password'); clearFieldError('confirmPassword') }} onBlur={() => validateField('password', validatePassword(password))} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} autoComplete="new-password" placeholder="8자 이상, 특수문자 1개 포함" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined} required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? <EyeSlash/> : <Eye/>}</button></div>{fieldErrors.password && <small className="signup-field-error" id="signup-password-error">{fieldErrors.password}</small>}</label>
          <label><span>비밀번호 확인</span><input value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); clearFieldError('confirmPassword') }} onBlur={() => validateField('confirmPassword', !confirmPassword ? '비밀번호를 한 번 더 입력해주세요.' : password !== confirmPassword ? '입력한 비밀번호가 서로 일치하지 않습니다.' : undefined)} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={72} autoComplete="new-password" placeholder="비밀번호를 다시 입력해주세요" aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-password-error' : undefined} required/>{fieldErrors.confirmPassword && <small className="signup-field-error" id="signup-confirm-password-error">{fieldErrors.confirmPassword}</small>}</label>
          <div><label className="signup-terms"><input checked={acceptedTerms} onChange={event => { setAcceptedTerms(event.target.checked); clearFieldError('terms') }} type="checkbox" aria-invalid={Boolean(fieldErrors.terms)} required/><span className="signup-check"><Check weight="bold"/></span><span>약관 및 개인정보 처리방침에 동의합니다 <b>*</b></span></label>{fieldErrors.terms && <small className="signup-field-error signup-terms-error">{fieldErrors.terms}</small>}</div>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </div>
        <footer className="signup-modal-footer"><button type="submit" disabled={submitting}>{submitting ? '가입 처리 중...' : '가입하기'}<ArrowRight weight="bold"/></button></footer>
      </form>
    </section>
  </div>
}
