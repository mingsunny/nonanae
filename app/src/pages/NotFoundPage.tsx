import { Link } from 'react-router-dom'
import Topbar from '../components/common/Topbar'
import { paths } from '../routes/paths'

export default function NotFoundPage() {
  return (
    <div>
      <Topbar title="페이지를 찾을 수 없어요" />
      <div style={{ padding: 'var(--space-sm) 20px' }}>
        <Link to={paths.groups}>그룹 목록으로</Link>
      </div>
    </div>
  )
}
