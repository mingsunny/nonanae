import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { BANKS } from '../../domain/constants'
import { NAME_MAX_LENGTH } from '../../domain/name'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { useAuthFlowStore } from '../../store/authFlowStore'
import styles from './auth.module.css'

/** 앱 안의 경로만 허용한다 (`/`로 시작하고 `//`로 시작하지 않는 것). 메일 링크의 `next`가 다른 사이트로 보내지 못하게 막는다. */
function safeInternalPath(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

/**
 * 02 이름·계좌 등록(`/signup/account`) — 회원가입의 마지막 단계. 이메일 확인 메일의 링크로 로그인된 사람(또는 이메일 확인이
 * 꺼져 있어 바로 로그인된 사람)이 이름·은행·계좌를 한 번 등록하면 프로필이 만들어지고 그룹 목록으로 들어간다.
 * 로그인되어 있지만 프로필이 없는 사람만 이 화면을 쓴다: 이미 프로필이 있으면 바로 다음 화면으로, 로그인 자체가 안 돼 있으면 가입 1단계로 보낸다.
 * 마친 뒤 돌아갈 곳은 메일 링크의 `next`(다른 브라우저에서 열어도 유지) → 이 기기에 남겨 둔 값 → 그룹 목록 순이다.
 */
export default function AccountScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const completeProfile = useAppStore((s) => s.completeProfile)
  const signOut = useAppStore((s) => s.signOut)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const needsProfile = useAppStore((s) => s.needsProfile)
  const resetAuthFlow = useAuthFlowStore((s) => s.reset)
  // 마친 직후 입력값을 비워도 도착지가 바뀌지 않도록, 들어올 때 한 번만 정한다
  const [nextPath] = useState(
    () => safeInternalPath(params.get('next')) ?? useAuthFlowStore.getState().returnTo ?? paths.groups,
  )
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
      await completeProfile({ name, bank, account })
      resetAuthFlow()
      // 프로필이 생기면 이 화면이 아래의 <Navigate>로 도착지로 이동한다
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록하지 못했어요')
      setBusy(false)
    }
  }

  /** 계좌 등록을 하지 않고 나가려는 경우. 계정은 남아 있어서 나중에 로그인하면 이 화면으로 다시 온다. */
  async function leave() {
    await signOut()
    navigate(paths.welcome, { replace: true })
  }

  if (currentUserId) return <Navigate to={nextPath} replace />
  if (!needsProfile) return <Navigate to={paths.signup} replace />

  return (
    <div>
      {/* 가입 확인 메일의 링크로 바로 들어오는 화면이라 노나내 로고를 보여준다 */}
      <Topbar title="계좌 등록" brand />
      <form className={styles.body} onSubmit={submit}>
        <Callout>
          이메일 확인이 끝났어요. 정산할 때 보낼 계좌를
          <br />
          바로 안내할 수 있도록 이름과 계좌 정보를 등록해주세요.
        </Callout>
        <label className={fields.label} htmlFor="signup-name">
          이름
        </label>
        <input
          id="signup-name"
          className={fields.input}
          type="text"
          maxLength={NAME_MAX_LENGTH}
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
            가입 완료
          </Button>
        </div>
        <p className={styles.switch}>
          <button type="button" className={fields.textLink} onClick={leave}>
            나중에 하기 (로그아웃)
          </button>
        </p>
      </form>
    </div>
  )
}
