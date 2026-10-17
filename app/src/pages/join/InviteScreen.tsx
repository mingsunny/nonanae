import { useState } from 'react'
import type { JoinResolution } from '../../api'
import Button from '../../components/common/Button'
import Topbar from '../../components/common/Topbar'
import AuthLinks from './AuthLinks'
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
 * 개인 초대 링크(`/join?code=코드-멤버ID`)로 들어왔을 때. 긴 코드 대신 그룹 이름과 "참여하기"만 보여주고,
 * 누르면 그 자리로 그룹장에게 참여를 요청한다 (링크를 여는 것만으로는 요청하지 않는다).
 */
export default function InviteScreen({ invite, code, onBack, onRequested }: Props) {
  const joinAsExistingMember = useAppStore((s) => s.joinAsExistingMember)
  const [busy, setBusy] = useState(false)

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
          {invite.memberName !== '' && <p className={styles.sub}>{invite.memberName}님으로 참여해요</p>}
        </div>
        <Button disabled={busy} onClick={() => void join()}>
          참여하기
        </Button>
        <p className={styles.notice}>그룹장이 승인하면 바로 시작할 수 있어요.</p>
        <div className={styles.addButton}>
          <AuthLinks code={code} />
        </div>
      </div>
    </div>
  )
}
