import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { RECOVERY_LINK_TOKEN, hasPasswordResetLink, isPasswordResetTokenValid, requestPasswordReset, resetPassword } from '../api'
import Button from '../components/common/Button'
import Callout from '../components/common/Callout'
import fields from '../components/common/Field.module.css'
import Topbar from '../components/common/Topbar'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import styles from './PasswordResetPage.module.css'

/**
 * 14. 비밀번호 재설정 — 이메일로 재설정 링크를 받고(1단계), 링크로 들어와 새 비밀번호를 정한다(2단계).
 * 목업은 링크에 `?token=`이 붙고, Supabase는 주소의 `#...`로 돌아오므로 그때는 자리 채움 토큰으로 2단계를 연다.
 * 프로토타입 UI가 없어 스펙의 표준 흐름 초안을 따랐다.
 */
export default function PasswordResetPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  // 링크로 열린 "첫 화면"일 때만 새 비밀번호 단계를 연다. 화면 안에서 다시 들어오면(예: 만료 안내의 "다시 받기") 일반 요청 화면이어야 한다.
  // 최초 진입 주소의 key는 'default'이고, 이후 화면 이동마다 새 key가 붙는다.
  const arrivedByLink = location.key === 'default' && hasPasswordResetLink()
  const token = params.get('token') ?? (arrivedByLink ? RECOVERY_LINK_TOKEN : null)
  return token ? <NewPasswordStep token={token} /> : <RequestStep />
}

/**
 * 링크를 보낸 뒤/비밀번호를 바꾼 뒤엔 이 화면에 머물지 않고 로그인 화면으로 돌아가, 그 위에 안내 박스를 띄운다.
 * 링크 발송 안내는 가입된 이메일인지와 무관하게 항상 같은 문구다 (14 예외처리: 계정 존재 여부 노출 방지).
 */
const linkSentState = { notice: '입력하신 이메일로 재설정 링크를 보냈어요. 메일함을 확인해주세요.' }
const passwordChangedState = { notice: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' }

/** 1단계: 이메일 입력 → 링크 발송 */
function RequestStep() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const canSubmit = email.trim().includes('@')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await requestPasswordReset(email)
      navigate(paths.login, { replace: true, state: linkSentState })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="비밀번호 재설정" onBack={() => navigate(paths.login)} />
      <div className={styles.body}>
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
        <div className={styles.back}>
          <Link to={paths.login} className={fields.textLink}>
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
      // 재설정 링크로 열린 화면은 임시 로그인 상태였을 수 있어서, 정리된 로그인 상태를 다시 읽는다
      await useAppStore.getState().refresh()
      navigate(paths.login, { replace: true, state: passwordChangedState })
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호를 바꾸지 못했어요')
      setBusy(false)
    }
  }

  if (valid === null) return <Topbar title="비밀번호 재설정" />

  if (!valid) {
    return (
      <div>
        <Topbar title="비밀번호 재설정" onBack={() => navigate(paths.login)} />
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
