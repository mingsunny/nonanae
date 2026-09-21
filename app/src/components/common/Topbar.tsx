import { Link } from 'react-router-dom'
import { BackIcon } from './icons'
import styles from './Topbar.module.css'

interface Props {
  title: string
  /** 뒤로가기를 링크로 (경로 이동만 할 때) */
  backTo?: string
  /** 뒤로가기를 버튼으로 (같은 화면 안에서 단계를 되돌리거나, 이동 전에 할 일이 있을 때) */
  onBack?: () => void
}

/** 뒤로가기 + 제목이 있는 상단바 (01/02/05/06/07/14 공용). 둘 다 없으면 제목만 보여준다. */
export default function Topbar({ title, backTo, onBack }: Props) {
  return (
    <div className={styles.topbar}>
      {backTo !== undefined && (
        <Link to={backTo} className={styles.back} aria-label="뒤로가기">
          <BackIcon size={14} />
        </Link>
      )}
      {backTo === undefined && onBack && (
        <button type="button" className={styles.back} aria-label="뒤로가기" onClick={onBack}>
          <BackIcon size={14} />
        </button>
      )}
      <h1 className={styles.title}>{title}</h1>
    </div>
  )
}
