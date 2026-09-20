import { Link } from 'react-router-dom'
import { paths } from '../routes/paths'

export default function NotFoundPage() {
  return (
    <div style={{ padding: 'var(--space-lg) var(--space-md)' }}>
      <h1>페이지를 찾을 수 없어요</h1>
      <Link to={paths.groups}>그룹 목록으로</Link>
    </div>
  )
}
