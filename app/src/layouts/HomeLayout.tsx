import { NavLink, Outlet } from 'react-router-dom'
import { HomeIcon, UserIcon } from '../components/common/icons'
import NotificationBell from '../components/notifications/NotificationBell'
import { useElementHeight } from '../lib/useElementHeight'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import styles from './HomeLayout.module.css'

/**
 * 그룹 밖 공용 레이아웃 (03 그룹 목록 / 04 프로필). 상단 인사말+알림 종과 하단 홈/프로필 탭바는 고정이고
 * 콘텐츠(Outlet)만 탭에 따라 바뀐다. 정식 회원 전용이라 RequireUser 안에서만 쓴다.
 */
export default function HomeLayout() {
  const user = useAppStore((s) => (s.currentUserId ? s.usersById[s.currentUserId] : undefined))
  // 상단바가 고정(position: fixed)이라 실제 높이만큼 콘텐츠 위쪽을 띄워야 가려지지 않는다.
  const [topbarRef, topbarHeight] = useElementHeight<HTMLElement>()

  const tabs = [
    { to: paths.groups, label: '홈', icon: <HomeIcon /> },
    { to: paths.profile, label: '프로필', icon: <UserIcon /> },
  ]

  return (
    <div className={styles.layout}>
      <header className={styles.topbar} ref={topbarRef}>
        <h1 className={styles.title}>{user ? `${user.name}님의 그룹` : '내 그룹'}</h1>
        <NotificationBell />
      </header>

      <main className={styles.content} style={{ paddingTop: topbarHeight + 8 /* --space-sm, 상단바 아래 여백 */ }}>
        <Outlet />
      </main>

      <nav className={styles.tabbar} aria-label="메인 메뉴">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
