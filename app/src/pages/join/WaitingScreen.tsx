import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { showToast } from '../../store/toastStore'
import styles from './join.module.css'

/** 승인됐는지 저절로 다시 확인하는 간격 */
export const JOIN_CHECK_INTERVAL_MS = 5000

interface Props {
  groupId: string
  groupName: string
  /** 방장이 승인해 그룹 안으로 들어갈 때 */
  onJoined: (groupId: string) => void
  /** 코드 입력 화면으로 돌아감 (요청은 그대로 남는다 — 취소는 "요청 취소하기"로만) */
  onBack: () => void
}

/**
 * 참여 요청을 보낸 뒤 방장 승인을 기다리는 화면("승인 요청중"). 승인돼도 알림이 가지 않으므로, 새로고침하거나
 * 같은 초대 링크를 다시 열면 들어갈 수 있다고 안내한다. 화면이 열려 있는 동안에는 몇 초마다 조용히 확인해
 * 승인되면 바로 그룹으로 들어간다. 요청이 사라졌으면(방장이 거절) 거절 안내로 바뀐다.
 */
export default function WaitingScreen({ groupId, groupName, onJoined, onBack }: Props) {
  const navigate = useNavigate()
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const checkJoinRequest = useAppStore((s) => s.checkJoinRequest)
  const cancelJoinRequest = useAppStore((s) => s.cancelJoinRequest)
  const [rejected, setRejected] = useState(false)
  const [busy, setBusy] = useState(false)
  // 취소 중에는 확인 결과(none)를 "거절됨"으로 보여주지 않도록
  const leaving = useRef(false)

  const check = useCallback(async () => {
    try {
      const status = await checkJoinRequest(groupId)
      if (leaving.current) return
      if (status === 'joined') {
        showToast('참여가 승인됐어요')
        onJoined(groupId)
      } else if (status === 'none') {
        setRejected(true)
      }
    } catch {
      // 다음 확인 때 다시 시도
    }
  }, [checkJoinRequest, groupId, onJoined])

  useEffect(() => {
    if (rejected) return
    const timer = setInterval(() => void check(), JOIN_CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [check, rejected])

  async function cancel() {
    if (busy) return
    setBusy(true)
    leaving.current = true
    try {
      await cancelJoinRequest(groupId)
      showToast('참여 요청을 취소했어요')
      onBack()
    } catch (err) {
      leaving.current = false
      showToast(err instanceof Error ? err.message : '취소하지 못했어요')
      setBusy(false)
    }
  }

  if (rejected) {
    return (
      <div>
        <Topbar title="참여 요청" onBack={onBack} brand />
        <div className={styles.body}>
          <Callout>[{groupName}] 그룹장이 참여 요청을 거절했어요.</Callout>
          <p className={styles.plain}>그룹장에게 확인한 뒤 다시 요청해주세요.</p>
          <Button onClick={onBack}>처음으로</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="참여 요청" onBack={onBack} brand />
      <div className={styles.body}>
        <Callout>
          [{groupName}] 그룹장에게 참여를 요청했어요.
          <br />
          그룹장이 승인하면 바로 시작할 수 있어요.
        </Callout>
        <div className={styles.status} role="status">
          <span className={styles.statusDot} aria-hidden="true" />
          승인 요청중
        </div>
        <p className={styles.plain}>
          승인돼도 따로 알림이 가지 않아요. 그룹장에게 승인을 부탁한 뒤, 이 화면을 새로고침하거나 같은 초대 링크를
          다시 열면 바로 들어갈 수 있어요.
        </p>
        {isLoggedIn && (
          <div className={styles.addButton}>
            <Button variant="outline" onClick={() => navigate(paths.groups)}>
              그룹 목록으로
            </Button>
          </div>
        )}
        <p className={styles.authLinks}>
          <button type="button" className={fields.textLink} disabled={busy} onClick={cancel}>
            요청 취소하기
          </button>
        </p>
      </div>
    </div>
  )
}
