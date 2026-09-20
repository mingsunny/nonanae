import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { BANKS } from '../../domain/constants'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { useAuthFlowStore } from '../../store/authFlowStore'
import styles from './auth.module.css'

/**
 * 02 회원가입 2단계(`/signup/account`, 계좌 등록). 제출하면 계정이 만들어지고 바로 로그인 상태로 그룹 목록에 들어간다.
 * 1단계 입력값을 넘겨받아야 하므로, 그 값 없이 URL로 바로 들어오면 1단계(`/signup`)로 되돌린다.
 */
export default function AccountScreen() {
  const navigate = useNavigate()
  const signUp = useAppStore((s) => s.signUp)
  const draft = useAuthFlowStore((s) => s.draft)
  const resetAuthFlow = useAuthFlowStore((s) => s.reset)
  // 가입을 마치며 입력값을 비워도 이 화면이 1단계로 되돌려 보내지 않도록, 들어올 때 한 번만 확인한다
  const [hasDraft] = useState(() => draft.email.trim() !== '' && draft.password !== '')
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [account, setAccount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 세 필드가 모두 채워져야 진행 가능 (필드별 에러 메시지는 없음). 계좌번호 형식 검증은 하지 않는다(02 예외처리).
  const canSubmit = name.trim() !== '' && bank !== '' && account.trim() !== ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await signUp({ email: draft.email, password: draft.password, name, bank, account })
      resetAuthFlow()
      navigate(paths.groups, { replace: true })
    } catch (err) {
      // 1단계 이후 다른 곳에서 같은 이메일이 가입된 경우도 여기서 잡힘 — 이메일을 고치려면 1단계로 돌아가야 함
      setError(err instanceof Error ? err.message : '가입하지 못했어요')
      setBusy(false)
    }
  }

  if (!hasDraft) return <Navigate to={paths.signup} replace />

  return (
    <div>
      <Topbar title="계좌 등록" onBack={() => navigate(paths.signup)} />
      <form className={styles.body} onSubmit={submit}>
        <Callout>
          정산할 때 보낼 계좌를 바로 안내할 수 있도록
          <br />
          이름과 계좌 정보를 등록해주세요.
        </Callout>
        <label className={fields.label} htmlFor="signup-name">
          이름
        </label>
        <input
          id="signup-name"
          className={fields.input}
          type="text"
          placeholder="예) 김민지"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
        />
        <label className={fields.label} htmlFor="signup-bank">
          은행
        </label>
        <select
          id="signup-bank"
          className={fields.select}
          value={bank}
          onChange={(e) => {
            setBank(e.target.value)
            setError(null)
          }}
        >
          <option value="">은행 선택</option>
          {BANKS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label className={fields.label} htmlFor="signup-account">
          계좌번호
        </label>
        <input
          id="signup-account"
          className={fields.input}
          type="text"
          inputMode="numeric"
          placeholder="예) 1000-1234-5678"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value)
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
            회원가입
          </Button>
        </div>
      </form>
    </div>
  )
}
