import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../api'
import Button from '../components/common/Button'
import fields from '../components/common/Field.module.css'
import PasswordInput from '../components/common/PasswordInput'
import Topbar from '../components/common/Topbar'
import { PASSWORD_RULE_HINT, passwordProblem } from '../domain/password'
import { usePrefetchCaptcha } from '../lib/captcha'
import { paths } from '../routes/paths'
import { showToast } from '../store/toastStore'
import styles from './PasswordResetPage.module.css'

/**
 * 04 프로필 → 비밀번호 변경 (`/profile/password`). 정식 회원 전용.
 * 현재 비밀번호가 맞아야 바꿀 수 있고, 새 비밀번호 규칙·확인은 가입/재설정과 같다. 바꾼 뒤에도 로그인 상태는 그대로다.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 현재 비밀번호 확인(재로그인)이 봇 확인을 거친다
  usePrefetchCaptcha()

  const confirmed = confirm.length > 0
  const matches = password === confirm
  const ruleProblem = password.length > 0 ? passwordProblem(password) : null
  const canSubmit = current.length > 0 && password.length > 0 && ruleProblem === null && confirmed && matches

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await changePassword(current, password)
      showToast('비밀번호가 변경되었습니다')
      navigate(paths.profile, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호를 바꾸지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="비밀번호 변경" backTo={paths.profile} />
      <form className={styles.body} onSubmit={submit}>
        <label className={fields.label} htmlFor="cp-current">
          현재 비밀번호
        </label>
        <PasswordInput
          id="cp-current"
          autoComplete="current-password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value)
            setError(null)
          }}
        />
        <label className={fields.label} htmlFor="cp-password">
          새 비밀번호
        </label>
        <PasswordInput
          id="cp-password"
          autoComplete="new-password"
          placeholder={PASSWORD_RULE_HINT}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
        />
        {ruleProblem && <p className={fields.error}>{ruleProblem}</p>}
        <label className={fields.label} htmlFor="cp-password-confirm">
          새 비밀번호 확인
        </label>
        <PasswordInput
          id="cp-password-confirm"
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
