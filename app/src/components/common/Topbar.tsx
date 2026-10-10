import { Link } from 'react-router-dom'
import logoUrl from '../../assets/logo-mark.png'
import { BackIcon } from './icons'
import styles from './Topbar.module.css'

interface Props {
  title: string
  /** 뒤로가기를 링크로 (경로 이동만 할 때) */
  backTo?: string
  /** 뒤로가기를 버튼으로 (같은 화면 안에서 단계를 되돌리거나, 이동 전에 할 일이 있을 때) */
  onBack?: () => void
  /**
   * 제목 위에 노나내 로고를 크게 보여준다. 메일·카카오톡 링크로 바로 들어올 수 있는 화면
   * (로그인, 비밀번호 재설정, 초대코드 참여)에서만 쓴다 — 앱 안에서 이어지는 단계(가입 등)에는 넣지 않는다.
   */
  brand?: boolean
}

/** 뒤로가기 + 제목이 있는 상단바 (01/02/05/06/07/14 공용). 둘 다 없으면 제목만 보여준다. */
export default function Topbar({ title, backTo, onBack, brand = false }: Props) {
  const back =
    backTo !== undefined ? (
      <Link to={backTo} className={styles.back} aria-label="뒤로가기">
        <BackIcon size={14} />
      </Link>
    ) : onBack ? (
      <button type="button" className={styles.back} aria-label="뒤로가기" onClick={onBack}>
        <BackIcon size={14} />
      </button>
    ) : null

  if (brand) {
    return (
      <div>
        <div className={styles.topbar}>{back}</div>
        <div className={styles.hero}>
          <img className={styles.logo} src={logoUrl} alt="노나내" />
          <h1 className={styles.heroTitle}>{title}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.topbar}>
      {back}
      <h1 className={styles.title}>{title}</h1>
    </div>
  )
}
