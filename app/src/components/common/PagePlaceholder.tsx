import styles from './PagePlaceholder.module.css'

interface Props {
  /** 스펙 번호 (docs/spec/NN-*.md) */
  spec: string
  title: string
  /** 화면 뼈대에서 확인용으로 보여줄 부가 정보 (경로 파라미터 등) */
  detail?: string
}

/** 아직 구현되지 않은 화면 자리표시자. 화면을 구현할 때 이 컴포넌트 사용을 걷어낼 것. */
export default function PagePlaceholder({ spec, title, detail }: Props) {
  return (
    <div className={styles.box}>
      <span className={styles.badge}>{spec}</span>
      <h1 className={styles.title}>{title}</h1>
      {detail && <p className={styles.detail}>{detail}</p>}
      <p className={styles.note}>구현 예정 — docs/spec/{spec}-*.md</p>
    </div>
  )
}
