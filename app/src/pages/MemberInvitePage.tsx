import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Avatar from '../components/common/Avatar'
import Button from '../components/common/Button'
import fields from '../components/common/Field.module.css'
import { BackIcon } from '../components/common/icons'
import type { GroupDetail } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { useCurrentGroup, useGroupView } from '../store/hooks'
import { showToast } from '../store/toastStore'
import styles from './MemberInvitePage.module.css'

/**
 * 12. 멤버 초대 — 멤버 목록 조회 + 앱 미가입 친구를 이름만으로 미리 추가(대기 중 멤버).
 * 그룹을 방금 만든 직후 05에서 이동해 올 때는 navigate(path, { state: { fromCreation: true } })로 넘기면
 * back 대신 하단 "그룹으로 가기" 버튼을 보여준다.
 */
export default function MemberInvitePage() {
  const group = useCurrentGroup()
  if (!group) return <Navigate to={paths.groups} replace />
  return <MemberInvite group={group} />
}

function MemberInvite({ group }: { group: GroupDetail }) {
  const navigate = useNavigate()
  const location = useLocation()
  const fromCreation = (location.state as { fromCreation?: boolean } | null)?.fromCreation === true
  const addPendingMember = useAppStore((s) => s.addPendingMember)
  const { nameOf, isMe, isPending } = useGroupView(group)
  const [name, setName] = useState('')
  const trimmed = name.trim()

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!trimmed) return
    try {
      await addPendingMember(group.id, trimmed)
      showToast(`${trimmed}님을 추가했어요`)
      setName('')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '추가하지 못했어요')
    }
  }

  /** 그 멤버 전용 개인화 링크(`{초대코드}-{Member.id}`)를 복사. 이 링크로 들어오면 매칭 화면 없이 그 자리에 연결됨. */
  async function sendInvite(memberId: string) {
    const link = `${window.location.origin}${paths.join}?code=${group.inviteCode}-${memberId}`
    const ok = await copyText(link)
    showToast(ok ? `${nameOf(memberId)}님에게 보낼 초대 링크를 복사했어요` : '복사하지 못했어요. 다시 시도해주세요')
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        {!fromCreation && (
          <Link to={paths.groupExpenses(group.id)} className={styles.back} aria-label="그룹으로">
            <BackIcon size={14} />
          </Link>
        )}
        <h1 className={styles.title}>멤버 목록</h1>
      </div>

      <div className={`${styles.body} ${fromCreation ? styles.withFooter : ''}`}>
        <div className={styles.callout}>
          이 그룹에 참여 중인 멤버예요. 초대는 그룹 화면 상단의
          <br />
          카카오톡/초대 코드 복사 버튼으로 언제든 할 수 있어요.
        </div>

        <div className={styles.card}>
          {group.members.map((m) => {
            const pending = isPending(m)
            return (
              <div key={m.id} className={styles.person}>
                <Avatar name={nameOf(m.id)} pending={pending} />
                <div className={styles.info}>
                  <div className={styles.name}>
                    {nameOf(m.id)}
                    {isMe(m.id) ? ' (나)' : ''}
                  </div>
                  {pending && <div className={styles.badge}>초대 대기 중</div>}
                </div>
                {pending && (
                  <button type="button" className={styles.send} onClick={() => sendInvite(m.id)}>
                    초대 보내기
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <form onSubmit={add}>
          <label className={fields.label} htmlFor="add-name">
            친구를 추가한 뒤 초대해봐요.
          </label>
          <div className={styles.addRow}>
            <input
              id="add-name"
              className={fields.input}
              type="text"
              placeholder="이름 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="outline" className={styles.addButton} disabled={!trimmed}>
              추가
            </Button>
          </div>
        </form>
      </div>

      {fromCreation && (
        <div className={styles.footer}>
          <Button onClick={() => navigate(paths.groupExpenses(group.id), { replace: true })}>그룹으로 가기</Button>
        </div>
      )}
    </div>
  )
}
