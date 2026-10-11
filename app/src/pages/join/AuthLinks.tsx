import { useNavigate } from 'react-router-dom'
import AccountPromoCard from '../../components/common/AccountPromoCard'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { useAuthFlowStore } from '../../store/authFlowStore'

/**
 * 초대코드를 확인한 뒤(07 멤버 고르기) 비로그인 사용자에게 "로그인 / 회원가입하고 참여"를 권하는 카드.
 * 로그인·가입을 마치면 같은 초대 링크(`/join?code=...`)로 돌아와 내 계정으로 참여를 이어간다.
 * 코드 입력 화면(06)에는 두지 않는다 — 코드를 넣기 전에 로그인하러 가면 돌아와서 코드를 다시 입력해야 한다.
 */
export default function AuthLinks({ code }: { code: string }) {
  const navigate = useNavigate()
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const setReturnTo = useAuthFlowStore((s) => s.setReturnTo)
  const startSignup = useAuthFlowStore((s) => s.startSignup)
  if (isLoggedIn) return null

  const trimmed = code.trim()
  const back = trimmed === '' ? paths.join : `${paths.join}?code=${encodeURIComponent(trimmed)}`

  return (
    <AccountPromoCard
      onLogin={() => {
        setReturnTo(back)
        navigate(paths.login)
      }}
      onSignup={() => {
        startSignup()
        setReturnTo(back)
        navigate(paths.signup)
      }}
    />
  )
}
