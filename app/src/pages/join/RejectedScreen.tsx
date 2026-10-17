import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import Topbar from '../../components/common/Topbar'
import styles from './join.module.css'

interface Props {
  groupName: string
  /** 다시 요청하기 → 초대(개인 링크) 또는 멤버 고르기(공용 코드) 화면으로 */
  onRetry: () => void
  onBack: () => void
}

/** 방장이 참여 요청을 거절했을 때. 대기 화면에서 바로, 또는 같은 링크를 다시 열었을 때 보인다. */
export default function RejectedScreen({ groupName, onRetry, onBack }: Props) {
  return (
    <div>
      <Topbar title="참여 요청" onBack={onBack} brand />
      <div className={styles.body}>
        <Callout>[{groupName}] 그룹장이 참여 요청을 거절했어요.</Callout>
        <div className={`${styles.status} ${styles.statusRejected}`} role="status">
          <span className={styles.statusDot} aria-hidden="true" />
          거절됨
        </div>
        <p className={styles.plain}>그룹장에게 확인한 뒤 다시 요청해주세요.</p>
        <Button onClick={onRetry}>다시 요청하기</Button>
      </div>
    </div>
  )
}
