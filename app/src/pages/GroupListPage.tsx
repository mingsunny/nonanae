import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import { sortGroupsNewestFirst } from '../domain/members'
import { groupTotal } from '../domain/settlement'
import { won } from '../lib/format'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import styles from './GroupListPage.module.css'

/**
 * 03. 그룹 목록 (홈 탭) — 내가 속한 그룹, 새 그룹 만들기 / 초대코드 입력 진입.
 * 상단 인사말과 알림 종(13), 하단 탭바는 HomeLayout이 그린다.
 */
export default function GroupListPage() {
  const navigate = useNavigate()
  const groups = useAppStore((s) => s.groups)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const viewAsMemberId = useAppStore((s) => s.viewAsMemberId)
  const seenCoach = useAppStore((s) =>
    s.currentUserId ? (s.usersById[s.currentUserId]?.seenGroupCreateCoach ?? true) : true,
  )
  const markGroupCreateCoachSeen = useAppStore((s) => s.markGroupCreateCoachSeen)

  // 그룹이 하나도 없고 아직 안내를 못 봤을 때만 1회 노출. 그룹이 없다는 안내를 목록 영역에 또 쓰지 않고 이 문구 하나로 통일 (03 예외처리)
  const showHint = groups.length === 0 && !seenCoach

  async function startCreate() {
    // "새 그룹 만들기"를 한 번이라도 누르면 안내는 다시 뜨지 않음
    await markGroupCreateCoachSeen()
    navigate(paths.groupNew)
  }

  return (
    <>
      <div className={styles.actions}>
        <Button onClick={startCreate}>＋ 새 그룹 만들기</Button>
        <Button variant="outline" onClick={() => navigate(paths.join)}>
          초대코드 입력
        </Button>
      </div>
      {showHint && <p className={styles.hint}>그룹을 만들고 정산을 시작해요</p>}

      {/* 가장 최근에 만들거나 참여한 그룹이 위 */}
      {sortGroupsNewestFirst(groups, currentUserId, viewAsMemberId).map((group) => (
        <Link key={group.id} to={paths.group(group.id)} className={styles.row}>
          <span className={styles.thumb}>{group.name.slice(0, 1)}</span>
          <span className={styles.meta}>
            <span className={styles.name}>{group.name}</span>
            <span className={`${styles.sum} num`}>
              멤버 {group.members.length}명 · 총 {won(groupTotal(group.expenses))}
            </span>
          </span>
          <span className={styles.arrow} aria-hidden="true">
            ›
          </span>
        </Link>
      ))}
    </>
  )
}
