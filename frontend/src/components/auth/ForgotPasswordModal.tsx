import { ArrowLeft, ArrowRight, Eye, EyeSlash, X } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { forgotPassword, resetPassword } from '../../services/auth'

interface ForgotPasswordModalProps {
  initialEmail: string
  onClose: () => void
  onComplete: () => void
}

type Step = 'email' | 'reset'
type ResetField = 'email' | 'resetCode' | 'password' | 'confirmPassword'
type ResetErrors = Partial<Record<ResetField, string>>

function validateEmail(value: string): string | undefined {
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value)) return '이메일 주소에는 한글을 사용할 수 없습니다.'
  if (!/^\S+@\S+\.\S+$/.test(value.trim())) return '@와 도메인을 포함한 이메일 주소를 입력해주세요.'
}

function validatePassword(value: string): string | undefined {
  if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (value.length > 72) return '비밀번호는 72자 이하로 입력해주세요.'
  if (!/[^A-Za-z0-9\s]/.test(value)) return '특수문자를 최소 1개 포함해주세요.'
}

export default function ForgotPasswordModal({ initialEmail, onClose, onComplete }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(initialEmail)
  const [resetCode, setResetCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ResetErrors>({})
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

  const clearError = (field: ResetField) => {
    setFieldErrors(current => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validateField = (field: ResetField, message: string | undefined) => {
    setFieldErrors(current => {
      const next = { ...current }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  const confirmPasswordError = (): string | undefined => {
    if (!confirmPassword) return '새 비밀번호를 한 번 더 입력해주세요.'
    if (password !== confirmPassword) return '입력한 비밀번호가 서로 일치하지 않습니다.'
  }

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const emailError = validateEmail(email)
    setFieldErrors(emailError ? { email: emailError } : {})
    if (emailError) return

    setError('')
    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
      setStep('reset')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '재설정 코드를 요청하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: ResetErrors = {}
    if (!/^\d{6}$/.test(resetCode)) nextErrors.resetCode = '이메일로 받은 6자리 코드를 입력해주세요.'
    const passwordError = validatePassword(password)
    if (passwordError) nextErrors.password = passwordError
    if (!confirmPassword) nextErrors.confirmPassword = '새 비밀번호를 한 번 더 입력해주세요.'
    else if (password !== confirmPassword) nextErrors.confirmPassword = '입력한 비밀번호가 서로 일치하지 않습니다.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setError('')
    setSubmitting(true)
    try {
      await resetPassword(email.trim(), resetCode, password)
      onComplete()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '비밀번호를 변경하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return <div className="signup-backdrop" onMouseDown={closeFromBackdrop}>
    <section className="signup-modal forgot-modal" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <header className="signup-modal-head">
        <div><h2 id="forgot-title">비밀번호 재설정</h2><p>{step === 'email' ? '가입한 이메일 주소를 입력해주세요.' : '인증 후 새 비밀번호를 설정해주세요.'}</p></div>
        <button type="button" onClick={onClose} aria-label="비밀번호 재설정 닫기"><X/></button>
      </header>

      {step === 'email' ? <form onSubmit={requestCode} noValidate>
        <div className="signup-modal-body">
          <label><span>이메일 주소</span><input value={email} onChange={event => { setEmail(event.target.value); clearError('email') }} onBlur={() => validateField('email', validateEmail(email))} type="email" autoComplete="email" placeholder="example@email.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'forgot-email-error' : undefined} autoFocus/>{fieldErrors.email && <small className="signup-field-error" id="forgot-email-error">{fieldErrors.email}</small>}</label>
          <p className="forgot-help">입력한 주소로 15분 동안 사용할 수 있는 인증코드를 보내드려요.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </div>
        <footer className="signup-modal-footer"><button type="submit" disabled={submitting}>{submitting ? '코드 요청 중...' : '인증코드 받기'}<ArrowRight weight="bold"/></button></footer>
      </form> : <form onSubmit={changePassword} noValidate>
        <div className="signup-modal-body">
          <div className="forgot-email-row"><span>{email}</span><button type="button" onClick={() => { setStep('email'); setError(''); setFieldErrors({}) }}><ArrowLeft/> 이메일 변경</button></div>
          <label><span>인증코드</span><input value={resetCode} onChange={event => { setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6)); clearError('resetCode') }} onBlur={() => validateField('resetCode', /^\d{6}$/.test(resetCode) ? undefined : '이메일로 받은 6자리 코드를 입력해주세요.')} inputMode="numeric" autoComplete="one-time-code" placeholder="6자리 숫자" maxLength={6} aria-invalid={Boolean(fieldErrors.resetCode)} aria-describedby={fieldErrors.resetCode ? 'forgot-code-error' : undefined} autoFocus/>{fieldErrors.resetCode && <small className="signup-field-error" id="forgot-code-error">{fieldErrors.resetCode}</small>}</label>
          <label><span>새 비밀번호</span><div className="signup-password"><input value={password} onChange={event => { setPassword(event.target.value); clearError('password'); if (confirmPassword) clearError('confirmPassword') }} onBlur={() => { validateField('password', validatePassword(password)); if (confirmPassword) validateField('confirmPassword', password === confirmPassword ? undefined : '입력한 비밀번호가 서로 일치하지 않습니다.') }} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8자 이상, 특수문자 1개 포함" minLength={8} maxLength={72} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'forgot-password-error' : undefined}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? <EyeSlash/> : <Eye/>}</button></div>{fieldErrors.password && <small className="signup-field-error" id="forgot-password-error">{fieldErrors.password}</small>}</label>
          <label><span>새 비밀번호 확인</span><input value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); clearError('confirmPassword') }} onBlur={() => validateField('confirmPassword', confirmPasswordError())} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="새 비밀번호를 다시 입력해주세요" minLength={8} maxLength={72} aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'forgot-confirm-error' : undefined}/>{fieldErrors.confirmPassword && <small className="signup-field-error" id="forgot-confirm-error">{fieldErrors.confirmPassword}</small>}</label>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </div>
        <footer className="signup-modal-footer"><button type="submit" disabled={submitting}>{submitting ? '변경 중...' : '비밀번호 변경하기'}<ArrowRight weight="bold"/></button></footer>
      </form>}
    </section>
  </div>
}
