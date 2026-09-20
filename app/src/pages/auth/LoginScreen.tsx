import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import styles from './auth.module.css'

interface Props {
  /** 회원가입으로 넘어갈 때 이메일을 이어 쓰도록 부모가 들고 있음 (01 액션 & 결과) */
  email: string
  onEmailChange: (email: string) => void
  onBack: () => void
}

/** 01 로그인 */
export default function LoginScreen({ email, onEmailChange, onBack }: Props) {
  const navigate = useNavigate()
  const signIn = useAppStore((s) => s.signIn)
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
      navigate(paths.groups, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="로그인" onBack={onBack} />
      <form className={styles.body} onSubmit={submit}>
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
            onEmailChange(e.target.value)
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
