import type { ReactNode } from 'react'
import styles from './Callout.module.css'

/** 왜 이 입력이 필요한지 알려주는 연한 초록 안내 박스 (프로토타입의 guide-callout) */
export default function Callout({ children }: { children: ReactNode }) {
  return <div className={styles.callout}>{children}</div>
}
