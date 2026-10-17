import { useState } from 'react'
import type { FormEvent } from 'react'
import type { JoinResolution } from '../../api'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import PrivacyLink from '../../components/common/PrivacyLink'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { parseInviteCode } from '../../domain/inviteCode'
import { NAME_MAX_LENGTH } from '../../domain/name'
import { useAppStore } from '../../store/appStore'
import { showToast } from '../../store/toastStore'
import { useAuthReturnActions } from './useAuthReturnActions'
import styles from './join.module.css'

export type PickResolution = Extract<JoinResolution, { kind: 'pick' }>

interface Props {
  pick: PickResolution
  /** 로그인·가입 후 같은 링크로 돌아오기 위한 초대코드 */
  code: string
  onBack: () => void
  /** 참여 요청을 보냈을 때 → 그룹장 승인 대기 화면으로 */
  onRequested: () => void
}

/**
 * 그룹 공용 코드(`/join?code=ABCDEF`)로 들어왔을 때. 멤버 목록에서 나를 고르는 단계 없이(누구인지는 그룹장이 승인하며 확인한다)
 * 그룹 이름과 참여 버튼만 보여준다: 로그인했으면 "{내 이름}님으로 참여하기", 아니면 이름 입력 + 로그인 / 회원가입.
 * 개인 초대 링크인데 그 자리가 이미 계정으로 가입돼 있으면, 본인일 가능성이 높으니 로그인을 권한다.
 */
export default function GroupJoinScreen({ pick, code, onBack, onRequested }: Props) {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const myName = useAppStore((s) => (s.currentUserId ? s.usersById[s.currentUserId]?.name : undefined))
  const joinAsNewGuest = useAppStore((s) => s.joinAsNewGuest)
  const joinAsNewAccountMember = useAppStore((s) => s.joinAsNewAccountMember)
  const { login, signup } = useAuthReturnActions(code)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const targetId = parseInviteCode(code).targetMemberId
  const takenSeat = targetId ? pick.candidates.find((c) => c.id === targetId && c.hasAccount) : undefined

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      onRequested()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '참여하지 못했어요')
      setBusy(false)
    }
  }

  function submitNewName(e: FormEvent) {
    e.preventDefault()
    if (newName.trim() !== '') void run(() => joinAsNewGuest(pick.groupId, newName))
  }

  const groupCard = (
    <div className={styles.inviteCard}>
      <p className={styles.inviteLabel}>초대받은 그룹</p>
      <p className={styles.inviteGroup}>{pick.groupName}</p>
    </div>
  )

  if (takenSeat && !isLoggedIn) {
    return (
      <div>
        <Topbar title="그룹 초대" onBack={onBack} brand />
        <div className={styles.body}>
          {groupCard}
          <Callout>
            {takenSeat.name}님 자리는 이미 가입돼 있어요.
            <br />
            본인이면 로그인해주세요.
          </Callout>
          <Button onClick={login}>로그인</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="그룹 초대" onBack={onBack} brand />
      <div className={styles.body}>
        {groupCard}
        {isLoggedIn ? (
          <Button disabled={busy} onClick={() => void run(() => joinAsNewAccountMember(pick.groupId))}>
            {myName ? `${myName}님으로 참여하기` : '참여하기'}
          </Button>
        ) : (
          <>
            <form onSubmit={submitNewName}>
              <label className={fields.label} htmlFor="jp-new-name">
                이름
              </label>
              <input
                id="jp-new-name"
                className={fields.input}
                type="text"
                maxLength={NAME_MAX_LENGTH}
                placeholder="예) 김민지"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className={styles.addButton}>
                <Button type="submit" disabled={newName.trim() === '' || busy}>
                  이 이름으로 참여하기
                </Button>
              </div>
            </form>
            <div className={styles.authRow}>
              <Button variant="outline" disabled={busy} onClick={login}>
                로그인
              </Button>
              <Button variant="outline" disabled={busy} onClick={signup}>
                회원가입
              </Button>
            </div>
            <p className={styles.notice}>
              참여하면 입력한 이름이 이 그룹 멤버로 저장돼요. <PrivacyLink className={styles.noticeLink} />
            </p>
          </>
        )}
      </div>
    </div>
  )
}
