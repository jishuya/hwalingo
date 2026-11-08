import { SignInIcon } from '@phosphor-icons/react'

export default function LoginRequired() {
  return <section className="login-required" role="alert">
    <span className="login-required-icon" aria-hidden="true"><SignInIcon weight="bold"/><i/></span>
    <h2>로그인을 다시 해주세요</h2>
    <a className="login-required-button" href="/login">로그인하기</a>
    <p>계정이 없으신가요? <a href="/login?signup=1">회원가입하기</a></p>
  </section>
}
