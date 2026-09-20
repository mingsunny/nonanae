import styles from './Avatar.module.css'

interface Props {
  name: string
  size?: 'sm' | 'md'
  /** 계정 없이 이름만 있는 멤버(대기 중)는 점선 테두리로 구분 */
  pending?: boolean
}

/** 이름 첫 글자를 보여주는 원형 아바타 */
export default function Avatar({ name, size = 'md', pending = false }: Props) {
  const className = [styles.avatar, size === 'sm' ? styles.sm : '', pending ? styles.pending : '']
    .filter(Boolean)
    .join(' ')
  return <span className={className}>{name.slice(0, 1)}</span>
}
