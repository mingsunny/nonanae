import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isPasswordResetTokenValid, requestPasswordReset, resetPassword } from '../api'
import Button from '../components/common/Button'
import Callout from '../components/common/Callout'
import fields from '../components/common/Field.module.css'
import Topbar from '../components/common/Topbar'
import { paths } from '../routes/paths'
import { showToast } from '../store/toastStore'
import styles from './PasswordResetPage.module.css'

/**
 * 14. 비밀번호 재설정 — 이메일로 재설정 링크를 받고(1단계), 링크(`?token=`)로 들어와 새 비밀번호를 정한다(2단계).
 * 프로토타입 UI가 없어 스펙의 표준 흐름 초안을 따랐다.
 */
export default function PasswordResetPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  return token ? <NewPasswordStep token={token} /> : <RequestStep />
}

/** 이 화면의 진입점은 로그인 화면이라, 돌아갈 때도 인트로가 아니라 로그인 화면으로 간다 */
const loginState = { step: 'login' }

/** 1단계: 이메일 입력 → 링크 발송 */
function RequestStep() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const canSubmit = email.trim().includes('@')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="비밀번호 재설정" onBack={() => navigate(paths.login, { state: loginState })} />
      <div className={styles.body}>
        {sent ? (
          // 가입된 이메일인지와 무관하게 항상 같은 문구 (14 예외처리: 계정 존재 여부 노출 방지)
          <Callout>입력하신 이메일로 재설정 링크를 보냈어요</Callout>
        ) : (
          <form onSubmit={submit}>
            <Callout>가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드려요</Callout>
            <label className={fields.label} htmlFor="reset-email">
              이메일
            </label>
            <input
              id="reset-email"
              className={fields.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className={styles.submit}>
              <Button type="submit" disabled={!canSubmit || busy}>
                재설정 링크 보내기
              </Button>
            </div>
          </form>
        )}
        <div className={styles.back}>
          <Link to={paths.login} state={loginState} className={fields.textLink}>
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}

/** 2단계: 메일 링크로 들어와 새 비밀번호 설정. 만료됐거나 이미 쓴 링크면 안내하고 다시 받도록 유도. */
function NewPasswordStep({ token }: { token: string }) {
  const navigate = useNavigate()
  const [valid, setValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void isPasswordResetTokenValid(token).then((ok) => {
      if (!cancelled) setValid(ok)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const confirmed = confirm.length > 0
  const matches = password === confirm
  const canSubmit = password.length > 0 && confirmed && matches

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await resetPassword(token, password)
      showToast('비밀번호가 변경되었습니다')
      navigate(paths.login, { replace: true, state: loginState })
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호를 바꾸지 못했어요')
      setBusy(false)
    }
  }

  if (valid === null) return <Topbar title="비밀번호 재설정" />

  if (!valid) {
    return (
      <div>
        <Topbar title="비밀번호 재설정" onBack={() => navigate(paths.login, { state: loginState })} />
        <div className={styles.body}>
          <Callout>링크가 만료되었거나 이미 사용됐어요. 재설정 링크를 다시 받아주세요.</Callout>
          <Button onClick={() => navigate(paths.passwordReset, { replace: true })}>재설정 링크 다시 받기</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="새 비밀번호 설정" />
      <form className={styles.body} onSubmit={submit}>
        <label className={fields.label} htmlFor="reset-password">
          새 비밀번호
        </label>
        <input
          id="reset-password"
          className={fields.input}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
        />
        <label className={fields.label} htmlFor="reset-password-confirm">
          비밀번호 확인
        </label>
        <input
          id="reset-password-confirm"
          className={fields.input}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setError(null)
          }}
        />
        {confirmed && (
          <p className={matches ? fields.ok : fields.error}>
            {matches ? '비밀번호가 일치해요.' : '비밀번호가 일치하지 않아요.'}
          </p>
        )}
        {error && (
          <p className={fields.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.submit}>
          <Button type="submit" disabled={!canSubmit || busy}>
            비밀번호 변경
          </Button>
        </div>
      </form>
    </div>
  )
}
