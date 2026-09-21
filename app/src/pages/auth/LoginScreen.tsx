import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { useAuthFlowStore } from '../../store/authFlowStore'
import styles from './auth.module.css'

/**
 * 01 로그인 (`/login`). 비밀번호 재설정(14)을 마치고 올 때는 `navigate(paths.login, { state: { notice } })`로
 * 안내 문구를 실어 보내면 폼 위에 안내 박스로 보여준다. 뒤로가기는 인트로(`/welcome`).
 */
export default function LoginScreen() {
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const signIn = useAppStore((s) => s.signIn)
  // 회원가입으로 넘어갈 때 이메일을 이어 쓰도록 화면 밖에서 들고 있음 (01 액션 & 결과)
  const email = useAuthFlowStore((s) => s.loginEmail)
  const setEmail = useAuthFlowStore((s) => s.setLoginEmail)
  const resetAuthFlow = useAuthFlowStore((s) => s.reset)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 이메일 형식 검증은 @ 포함 여부만 (01 예외처리: 정식 검증 정책 미정)
  const canSubmit = email.trim().includes('@') && password.length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await signIn(email, password)
      resetAuthFlow()
      navigate(paths.groups, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="로그인" onBack={() => navigate(paths.welcome)} />
      <form className={styles.body} onSubmit={submit}>
        {notice && <Callout>{notice}</Callout>}
        <label className={fields.label} htmlFor="login-email">
          이메일
        </label>
        <input
          id="login-email"
          className={fields.input}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
        />
        <label className={fields.label} htmlFor="login-password">
          비밀번호
        </label>
        <input
          id="login-password"
          className={fields.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
        />
        {error && (
          <p className={fields.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.submit}>
          <Button type="submit" disabled={!canSubmit || busy}>
            로그인
          </Button>
        </div>
        <div className={styles.forgot}>
          <Link to={paths.passwordReset} className={fields.textLink}>
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </form>
    </div>
  )
}
