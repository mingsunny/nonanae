import { useNavigate } from 'react-router-dom'
import { paths } from '../../routes/paths'
import { useAuthFlowStore } from '../../store/authFlowStore'

/** 로그인·가입하러 가되, 마치면 같은 초대 링크(`/join?code=...`)로 돌아오게 하는 두 동작 */
export function useAuthReturnActions(code: string) {
  const navigate = useNavigate()
  const setReturnTo = useAuthFlowStore((s) => s.setReturnTo)
  const startSignup = useAuthFlowStore((s) => s.startSignup)
  const trimmed = code.trim()
  const back = trimmed === '' ? paths.join : `${paths.join}?code=${encodeURIComponent(trimmed)}`
  return {
    login: () => {
      setReturnTo(back)
      navigate(paths.login)
    },
    signup: () => {
      startSignup()
      setReturnTo(back)
      navigate(paths.signup)
    },
  }
}
