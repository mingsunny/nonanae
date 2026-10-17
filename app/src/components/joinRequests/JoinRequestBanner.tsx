import { Link } from 'react-router-dom'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import styles from './JoinRequestBanner.module.css'

/**
 * 그룹장에게만: 이 그룹에 승인을 기다리는 참여 요청이 있으면 그룹 화면 맨 위에 띄운다.
 * "확인하기"는 승인/거절 버튼이 있는 멤버 화면(12)으로. 요청이 없으면 아무것도 그리지 않는다.
 */
export default function JoinRequestBanner({ groupId }: { groupId: string }) {
  const allJoinRequests = useAppStore((s) => s.joinRequests)
  // 내가 방장인 그룹에 들어온 요청만 mine=false로 내려온다
  const requests = allJoinRequests.filter((r) => r.groupId === groupId && !r.mine)
  if (requests.length === 0) return null

  const first = requests[0].name
  const who = requests.length === 1 ? `${first}님이` : `${first}님 외 ${requests.length - 1}명이`
  return (
    <Link to={paths.groupMembers(groupId)} className={styles.banner}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>{who} 참여를 요청했어요</span>
      <span className={styles.action}>확인하기 ›</span>
    </Link>
  )
}
