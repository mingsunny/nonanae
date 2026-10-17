import { useState } from 'react'
import type { JoinResolution } from '../../api'
import Button from '../../components/common/Button'
import Topbar from '../../components/common/Topbar'
import { useAuthReturnActions } from './useAuthReturnActions'
import { useAppStore } from '../../store/appStore'
import { showToast } from '../../store/toastStore'
import styles from './join.module.css'

export type InviteResolution = Extract<JoinResolution, { kind: 'invite' }>

interface Props {
  invite: InviteResolution
  /** 로그인·가입 후 같은 초대 링크로 돌아오기 위한 초대코드 */
  code: string
  onBack: () => void
  /** 참여 요청을 보냈을 때 → 그룹장 승인 대기 화면으로 */
  onRequested: () => void
}

/**
 * 개인 초대 링크(`/join?code=코드-멤버ID`)로 들어왔을 때. 긴 코드 대신 그룹 이름과 "김민지님으로 참여하기"만
 * 크게 보여주고, 누르면 그 자리로 그룹장에게 참여를 요청한다 (링크를 여는 것만으로는 요청하지 않는다).
 * 비로그인이면 그 아래 로그인 / 회원가입 (마치면 이 화면으로 돌아온다).
 * 로그인했으면 그 자리를 내 계정 이름으로 이어받으므로 버튼에 내 이름을 쓴다.
 */
export default function InviteScreen({ invite, code, onBack, onRequested }: Props) {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const myName = useAppStore((s) => (s.currentUserId ? s.usersById[s.currentUserId]?.name : undefined))
  const joinAsExistingMember = useAppStore((s) => s.joinAsExistingMember)
  const { login, signup } = useAuthReturnActions(code)
  const [busy, setBusy] = useState(false)
  // 정식 회원이 그 자리로 들어가면 멤버 이름은 계정(프로필) 이름을 따른다
  const joinName = (isLoggedIn ? myName : invite.memberName) ?? ''

  async function join() {
    if (busy) return
    setBusy(true)
    try {
      await joinAsExistingMember(invite.groupId, invite.memberId)
      onRequested()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '참여하지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="그룹 초대" onBack={onBack} brand />
      <div className={styles.body}>
        <div className={styles.inviteCard}>
          <p className={styles.inviteLabel}>초대받은 그룹</p>
          <p className={styles.inviteGroup}>{invite.groupName}</p>
        </div>
        <Button disabled={busy} onClick={() => void join()}>
          {joinName !== '' ? `${joinName}님으로 참여하기` : '참여하기'}
        </Button>
        {!isLoggedIn && (
          <div className={styles.authRow}>
            <Button variant="outline" disabled={busy} onClick={login}>
              로그인
            </Button>
            <Button variant="outline" disabled={busy} onClick={signup}>
              회원가입
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
