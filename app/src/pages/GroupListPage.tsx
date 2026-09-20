import { Link } from 'react-router-dom'
import NotificationBell from '../components/notifications/NotificationBell'
import { groupTotal } from '../domain/settlement'
import { won } from '../lib/format'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import styles from './GroupListPage.module.css'

/**
 * 03. 그룹 목록 — 임시 화면. 08~13을 오갈 수 있도록 최소한의 목록과 알림 종만 둠.
 * 03 담당(민선)이 구현할 때 이 파일을 통째로 교체하되, 상단에 `<NotificationBell />`(13)은 유지할 것.
 */
export default function GroupListPage() {
  const groups = useAppStore((s) => s.groups)
  const currentUser = useAppStore((s) => (s.currentUserId ? s.usersById[s.currentUserId] : undefined))

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.title}>{currentUser ? `${currentUser.name}님의 그룹` : '내 그룹'}</h1>
        <NotificationBell />
      </div>

      <p className={styles.note}>임시 화면 — 03 그룹 목록은 구현 예정 (docs/spec/03-*.md)</p>

      {groups.map((group) => (
        <Link key={group.id} to={paths.group(group.id)} className={styles.row}>
          <span className={styles.thumb}>{group.name.slice(0, 1)}</span>
          <span className={styles.meta}>
            <span className={styles.name}>{group.name}</span>
            <span className={`${styles.sum} num`}>
              {won(groupTotal(group.expenses))} · 멤버 {group.members.length}명
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
