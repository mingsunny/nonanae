import { NavLink, Outlet, useParams } from 'react-router-dom'
import { paths } from '../routes/paths'
import styles from './GroupLayout.module.css'

/**
 * 그룹 내부 공용 레이아웃 (08 지출 / 09 정산 / 10 요약).
 * 헤더와 하단 탭바는 고정, 콘텐츠 영역(Outlet)만 탭에 따라 교체됨. (08 §3.1, §3.2)
 * TODO: 그룹명·총 사용 금액·멤버 아바타 줄·초대 버튼(08 §3.1) — 데이터 계층 연결 후 구현
 */
export default function GroupLayout() {
  const { groupId = '' } = useParams()

  const tabs = [
    { to: paths.groupExpenses(groupId), label: '지출' },
    { to: paths.groupSettle(groupId), label: '정산' },
    { to: paths.groupSummary(groupId), label: '요약' },
  ]

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <NavLink to={paths.groups} className={styles.back} aria-label="그룹 목록으로">
          ‹
        </NavLink>
        <span className={styles.groupName}>그룹 {groupId}</span>
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>

      <nav className={styles.tabbar} aria-label="그룹 메뉴">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.active}` : styles.tab
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
