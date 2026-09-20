import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface Props {
  /** 문구 위에 크게 보여줄 기호 (예: ＋, ✓, 🔔) */
  icon?: string
  children: ReactNode
}

export default function EmptyState({ icon, children }: Props) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {children}
    </div>
  )
}
