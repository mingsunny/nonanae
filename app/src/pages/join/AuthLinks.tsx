import AccountPromoCard from '../../components/common/AccountPromoCard'
import { useAppStore } from '../../store/appStore'
import { useAuthReturnActions } from './useAuthReturnActions'

/**
 * 초대코드를 확인한 뒤(07 멤버 고르기) 비로그인 사용자에게 "로그인 / 회원가입하고 참여"를 권하는 카드.
 * 로그인·가입을 마치면 같은 초대 링크(`/join?code=...`)로 돌아와 내 계정으로 참여를 이어간다.
 * 코드 입력 화면(06)에는 두지 않는다 — 코드를 넣기 전에 로그인하러 가면 돌아와서 코드를 다시 입력해야 한다.
 */
export default function AuthLinks({ code }: { code: string }) {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const { login, signup } = useAuthReturnActions(code)
  if (isLoggedIn) return null
  return <AccountPromoCard onLogin={login} onSignup={signup} />
}
