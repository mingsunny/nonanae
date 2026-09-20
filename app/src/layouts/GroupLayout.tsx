import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BackIcon, BarsIcon, KakaoIcon, ReceiptIcon, TransferIcon } from '../components/common/icons'
import Avatar from '../components/common/Avatar'
import { groupTotal } from '../domain/settlement'
import type { GroupDetail } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { won } from '../lib/format'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { useCurrentGroup, useGroupView } from '../store/hooks'
import { showToast } from '../store/toastStore'
import styles from './GroupLayout.module.css'

/**
 * 그룹 내부 공용 레이아웃 (08 지출 / 09 정산 / 10 요약).
 * 헤더와 하단 탭바는 고정, 콘텐츠 영역(Outlet)만 탭에 따라 교체됨. (08 §3.1, §3.2)
 */
export default function GroupLayout() {
  const group = useCurrentGroup()
  if (!group) return <Navigate to={paths.groups} replace />
  return <GroupShell group={group} />
}

function GroupShell({ group }: { group: GroupDetail }) {
  const navigate = useNavigate()
  const { nameOf, isPending } = useGroupView(group)
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const signOut = useAppStore((s) => s.signOut)

  const tabs = [
    { to: paths.groupExpenses(group.id), label: '지출', icon: <ReceiptIcon /> },
    { to: paths.groupSettle(group.id), label: '정산', icon: <TransferIcon /> },
    { to: paths.groupSummary(group.id), label: '요약', icon: <BarsIcon /> },
  ]

  /** 로그인 없이 참여한 게스트에겐 그룹 목록이 없다 — 이 그룹 세션을 끝내고 인트로로 나간다 (sep19 goGlobalHome) */
  function leaveAsGuest() {
    navigate(paths.welcome)
    void signOut()
  }

  async function copyInviteCode() {
    const ok = await copyText(group.inviteCode)
    showToast(ok ? '초대코드가 복사되었습니다' : '복사하지 못했어요. 코드: ' + group.inviteCode)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.topbar}>
          {/* 그룹 내 어느 탭에서든 back은 항상 그룹 목록으로 (08 §4). 게스트는 목록이 없어 인트로로 나감 */}
          {isLoggedIn ? (
            <Link to={paths.groups} className={styles.back} aria-label="그룹 목록으로">
              <BackIcon size={14} />
            </Link>
          ) : (
            <button type="button" className={styles.back} aria-label="나가기" onClick={leaveAsGuest}>
              <BackIcon size={14} />
            </button>
          )}
          <h1 className={styles.groupName}>{group.name}</h1>
        </div>

        <div className={styles.caption}>이 여행에서 총 사용한 금액</div>
        <div className={`${styles.total} num`}>{won(groupTotal(group.expenses))}</div>

        <button
          type="button"
          className={styles.members}
          onClick={() => navigate(paths.groupMembers(group.id))}
          aria-label="멤버 목록 보기"
        >
          {group.members.map((m) => (
            <span key={m.id} className={styles.chip}>
              <Avatar name={nameOf(m.id)} size="sm" pending={isPending(m)} />
            </span>
          ))}
        </button>

        <div className={styles.pills}>
          <Link to={paths.groupMembers(group.id)} className={`${styles.pill} ${styles.kakao}`}>
            <KakaoIcon />
            멤버 초대
          </Link>
          <button type="button" className={styles.pill} onClick={copyInviteCode}>
            초대 코드 복사
          </button>
        </div>
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>

      <nav className={styles.tabbar} aria-label="그룹 메뉴">
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
