import { Navigate, Outlet } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { paths } from './paths'

/**
 * 정식 회원(로그인)만 들어올 수 있는 화면(03 그룹 목록, 04 프로필, 05 그룹 생성)을 감싼다.
 * 로그인이 안 돼 있으면 인트로(`/welcome`)로 보낸다 — 앱을 처음 열었을 때(`/` → `/groups`)도 여기서 인트로로 간다.
 * 그룹 안(08~13)은 로그인 없이 초대코드로 참여한 게스트도 볼 수 있어서 이 안에 넣지 않는다.
 */
export default function RequireUser() {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  return isLoggedIn ? <Outlet /> : <Navigate to={paths.welcome} replace />
}
