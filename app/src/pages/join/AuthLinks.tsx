import { useNavigate } from 'react-router-dom'
import fields from '../../components/common/Field.module.css'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { useAuthFlowStore } from '../../store/authFlowStore'
import styles from './join.module.css'

/**
 * 초대코드로 들어온 비로그인 사용자에게 "로그인 / 회원가입하고 참여"를 안내한다.
 * 로그인·가입을 마치면 같은 초대 링크(`/join?code=...`)로 돌아와 내 계정으로 참여를 이어간다.
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
    <p className={styles.authLinks}>
      계정이 있으면 로그인하고 참여할 수 있어요.{' '}
      <button
        type="button"
        className={fields.textLink}
        onClick={() => {
          setReturnTo(back)
          navigate(paths.login)
        }}
      >
        로그인
      </button>
      {' · '}
      <button
        type="button"
        className={fields.textLink}
        onClick={() => {
          startSignup()
          setReturnTo(back)
          navigate(paths.signup)
        }}
      >
        회원가입
      </button>
    </p>
  )
}
