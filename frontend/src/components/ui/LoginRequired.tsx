import { SignInIcon } from '@phosphor-icons/react'
import PageNotice from './PageNotice'

export default function LoginRequired() {
  return <PageNotice icon={<SignInIcon weight="bold"/>} title="로그인을 다시 해주세요" role="alert">
    <a className="page-notice-button" href="/login">로그인하기</a>
    <p>계정이 없으신가요? <a href="/login?signup=1">회원가입하기</a></p>
  </PageNotice>
}
