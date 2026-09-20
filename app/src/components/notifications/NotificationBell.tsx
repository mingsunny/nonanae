import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../common/EmptyState'
import { BellIcon, CloseIcon } from '../common/icons'
import type { Notification } from '../../domain/types'
import { relativeTime } from '../../lib/format'
import { paths } from '../../routes/paths'
import { selectHasUnreadNotifications, useAppStore } from '../../store/appStore'
import styles from './NotificationBell.module.css'

/**
 * 13. 알림 — 종 아이콘 + 안 읽음 표시 + 눌렀을 때 열리는 오버레이 패널.
 * 그룹 목록(03) 상단에 `<NotificationBell />`을 두면 되고, 별도 URL은 없다.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const hasUnread = useAppStore(selectHasUnreadNotifications)

  return (
    <>
      <button type="button" className={styles.bell} aria-label="알림 열기" onClick={() => setOpen(true)}>
        <BellIcon size={22} />
        {hasUnread && <span className={styles.dot} aria-label="읽지 않은 알림 있음" />}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const notifications = useAppStore((s) => s.notifications)
  const markNotificationRead = useAppStore((s) => s.markNotificationRead)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /** 알림 종류와 상관없이 해당 그룹의 지출 탭으로. 읽음 처리 → 패널 닫힘 → 이동 (13 §4) */
  async function openNotification(n: Notification) {
    await markNotificationRead(n.id)
    onClose()
    navigate(paths.groupExpenses(n.groupId))
  }

  return (
    // 배경 탭은 패널만 닫고 읽음 처리는 하지 않음
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.frame}>
        <div className={styles.panel} role="dialog" aria-label="알림">
          <div className={styles.head}>
            <h2 className={styles.heading}>알림</h2>
            <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
              <CloseIcon size={13} />
            </button>
          </div>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <EmptyState icon="🔔">아직 도착한 알림이 없어요.</EmptyState>
            ) : (
              notifications.map((n) => (
                <button key={n.id} type="button" className={styles.row} onClick={() => openNotification(n)}>
                  <div className={styles.title}>
                    {!n.read && <span className={styles.unread} />}
                    {n.title}
                  </div>
                  <div className={styles.time}>{relativeTime(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
