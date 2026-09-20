import { NavLink, Outlet } from 'react-router-dom'
import { HomeIcon, UserIcon } from '../components/common/icons'
import NotificationBell from '../components/notifications/NotificationBell'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import styles from './HomeLayout.module.css'

/**
 * 그룹 밖 공용 레이아웃 (03 그룹 목록 / 04 프로필). 상단 인사말+알림 종과 하단 홈/프로필 탭바는 고정이고
 * 콘텐츠(Outlet)만 탭에 따라 바뀐다. 정식 회원 전용이라 RequireUser 안에서만 쓴다.
 */
export default function HomeLayout() {
  const user = useAppStore((s) => (s.currentUserId ? s.usersById[s.currentUserId] : undefined))

  const tabs = [
    { to: paths.groups, label: '홈', icon: <HomeIcon /> },
    { to: paths.profile, label: '프로필', icon: <UserIcon /> },
  ]

  return (
    <div className={styles.layout}>
      <header className={styles.topbar}>
        <h1 className={styles.title}>{user ? `${user.name}님의 그룹` : '내 그룹'}</h1>
        <NotificationBell />
      </header>

      <main className={styles.content}>
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
