import Button from './Button'
import styles from './StartupError.module.css'

/** 처음 데이터를 불러오지 못했을 때(네트워크 끊김, 서버 오류) 빈 화면 대신 보여주는 화면 */
export default function StartupError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.title}>불러오지 못했어요</p>
      <p className={styles.text}>네트워크 상태를 확인하고 다시 시도해주세요.</p>
      <Button onClick={onRetry}>다시 시도</Button>
    </div>
  )
}
