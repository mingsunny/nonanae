import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { BANKS } from '../../domain/constants'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import type { SignupDraft } from '../LoginPage'
import styles from './auth.module.css'

interface Props {
  /** 1단계에서 입력한 이메일/비밀번호 */
  draft: SignupDraft
  onBack: () => void
}

/** 02 회원가입 2단계(계좌 등록). 제출하면 계정이 만들어지고 바로 로그인 상태로 그룹 목록에 들어간다. */
export default function AccountScreen({ draft, onBack }: Props) {
  const navigate = useNavigate()
  const signUp = useAppStore((s) => s.signUp)
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
      navigate(paths.groups, { replace: true })
    } catch (err) {
      // 1단계 이후 다른 곳에서 같은 이메일이 가입된 경우도 여기서 잡힘 — 이메일을 고치려면 1단계로 돌아가야 함
      setError(err instanceof Error ? err.message : '가입하지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="계좌 등록" onBack={onBack} />
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
