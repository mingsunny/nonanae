import { CATEGORY_COLORS } from '../../domain/constants'
import type { Category } from '../../domain/types'
import styles from './CategoryBadge.module.css'

/** 카테고리 첫 글자를 카테고리 색 배경 위에 보여주는 배지 */
export default function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className={styles.badge} style={{ background: CATEGORY_COLORS[category] }}>
      {category.slice(0, 1)}
    </span>
  )
}
