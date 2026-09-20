import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { isEmailTaken } from '../../api'
import { paths } from '../../routes/paths'
import { useAuthFlowStore } from '../../store/authFlowStore'
import type { SignupDraft } from '../../store/authFlowStore'
import styles from './auth.module.css'

/** 01 회원가입 1단계 (`/signup`, 이메일 / 비밀번호). 이 단계에서는 계정을 만들지 않고, 2단계(02) 제출 때 한 번에 만든다. */
export default function SignupScreen() {
  const navigate = useNavigate()
  const draft = useAuthFlowStore((s) => s.draft)
  const patchDraft = useAuthFlowStore((s) => s.patchDraft)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const confirmed = draft.passwordConfirm.length > 0
  const matches = draft.password === draft.passwordConfirm
  const canSubmit = draft.email.trim().includes('@') && draft.password.length > 0 && confirmed && matches

  function edit(patch: Partial<SignupDraft>) {
    patchDraft(patch)
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      if (await isEmailTaken(draft.email)) {
        setError('이미 가입된 이메일이에요. 로그인해주세요.')
        return
      }
      navigate(paths.signupAccount)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="회원가입" onBack={() => navigate(paths.welcome)} />
      <form className={styles.body} onSubmit={submit}>
        <label className={fields.label} htmlFor="signup-email">
          이메일
        </label>
        <input
          id="signup-email"
          className={fields.input}
          type="email"
          autoComplete="email"
          placeholder="예) mingsun@example.com"
          value={draft.email}
          onChange={(e) => edit({ email: e.target.value })}
        />
        <label className={fields.label} htmlFor="signup-password">
          비밀번호
        </label>
        <input
          id="signup-password"
          className={fields.input}
          type="password"
          autoComplete="new-password"
          placeholder="8자 이상"
          value={draft.password}
          onChange={(e) => edit({ password: e.target.value })}
        />
        <label className={fields.label} htmlFor="signup-password-confirm">
          비밀번호 확인
        </label>
        <input
          id="signup-password-confirm"
          className={fields.input}
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력해주세요"
          value={draft.passwordConfirm}
          onChange={(e) => edit({ passwordConfirm: e.target.value })}
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
            다음
          </Button>
        </div>
        <p className={styles.switch}>
          이미 계정이 있으신가요?{' '}
          <button type="button" className={fields.textLink} onClick={() => navigate(paths.login)}>
            로그인
          </button>
        </p>
      </form>
    </div>
  )
}
