import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/common/Avatar'
import Button from '../components/common/Button'
import fields from '../components/common/Field.module.css'
import { BANKS } from '../domain/constants'
import type { User } from '../domain/types'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { showToast } from '../store/toastStore'
import styles from './ProfilePage.module.css'

/** 04. 프로필 (홈 레이아웃의 두 번째 탭) — 내 이름/은행/계좌 수정, 로그아웃, 회원 탈퇴. 정식 회원 전용. */
export default function ProfilePage() {
  const user = useAppStore((s) => (s.currentUserId ? s.usersById[s.currentUserId] : undefined))
  if (!user) return null
  return <Profile user={user} />
}

function Profile({ user }: { user: User }) {
  const navigate = useNavigate()
  const updateProfile = useAppStore((s) => s.updateProfile)
  const signOut = useAppStore((s) => s.signOut)
  const deleteAccount = useAppStore((s) => s.deleteAccount)

  const [name, setName] = useState(user.name)
  const [bank, setBank] = useState(user.bank ?? '')
  const [account, setAccount] = useState(user.account ?? '')

  // 세 필드가 모두 채워져 있고 저장된 값과 달라야 저장할 수 있음 — 저장 직후엔 다시 비활성 (04 액션 & 결과)
  const filled = name.trim() !== '' && bank !== '' && account.trim() !== ''
  const changed =
    name.trim() !== user.name || bank !== (user.bank ?? '') || account.trim() !== (user.account ?? '')
  const canSave = filled && changed

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    try {
      await updateProfile({ name, bank, account })
      showToast('프로필이 저장되었습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장하지 못했어요')
    }
  }

  // 로그아웃·탈퇴 후엔 인트로가 아니라 로그인 화면으로 (01 진입 경로). 화면을 먼저 옮긴 뒤 세션을 지운다.
  function leaveToLogin() {
    navigate(paths.login, { replace: true })
  }

  async function logout() {
    leaveToLogin() // 확인 절차 없이 즉시 (04 예외처리)
    await signOut()
  }

  async function withdraw() {
    if (!window.confirm('정말 탈퇴하시겠어요? 계정 정보가 삭제돼요.')) return
    leaveToLogin()
    await deleteAccount()
  }

  return (
    <form onSubmit={save}>
      <div className={styles.card}>
        <Avatar name={user.name} />
        <div>
          <div className={styles.name}>{user.name}</div>
          <div className={styles.sub}>이메일 계정으로 로그인함</div>
        </div>
      </div>

      <label className={fields.label} htmlFor="pf-name">
        이름
      </label>
      <input id="pf-name" className={fields.input} type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <label className={fields.label} htmlFor="pf-bank">
        은행
      </label>
      <select id="pf-bank" className={fields.select} value={bank} onChange={(e) => setBank(e.target.value)}>
        {BANKS.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <label className={fields.label} htmlFor="pf-account">
        계좌번호
      </label>
      <input
        id="pf-account"
        className={fields.input}
        type="text"
        inputMode="numeric"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
      />

      <div className={styles.save}>
        <Button type="submit" disabled={!canSave}>
          저장하기
        </Button>
      </div>

      <div className={styles.links}>
        <button type="button" className={fields.textLink} onClick={logout}>
          로그아웃
        </button>
        <button type="button" className={fields.textLink} onClick={withdraw}>
          회원 탈퇴
        </button>
      </div>
    </form>
  )
}
