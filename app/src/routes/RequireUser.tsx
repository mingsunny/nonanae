import { Navigate, Outlet } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { paths } from './paths'

/**
 * 정식 회원(로그인)만 들어올 수 있는 화면(03 그룹 목록, 04 프로필, 05 그룹 생성)을 감싼다.
 * 로그인이 안 돼 있으면 인트로(`/welcome`)로 보낸다 — 앱을 처음 열었을 때(`/` → `/groups`)도 여기서 인트로로 간다.
 * 그룹 안(08~13)은 로그인 없이 초대코드로 참여한 게스트도 볼 수 있어서 이 안에 넣지 않는다.
 *
 * 예외: `leavingToLogin`이 true면(로그아웃/탈퇴 직후) 인트로가 아니라 로그인 화면으로 보낸다(01/04 진입 경로).
 * 화면(ProfilePage)이 먼저 `navigate(paths.login)`을 부르지만, 그 직후 currentUserId가 null이 되면서
 * 이 컴포넌트도 다시 렌더링돼 "로그인 안 됨"으로 보고 스스로 리다이렉트를 시도한다 — 두 리다이렉트가 경쟁하면
 * 나중 것이 이겨서 인트로로 덮어써버릴 수 있다(실제 브라우저에서 재현됨; jsdom 테스트 환경은 타이밍이 달라
 * 드러나지 않았음). signOut/deleteAccount가 currentUserId를 지우는 것과 같은 타이밍에 이 플래그도 함께
 * 켜두면, 이 컴포넌트가 스스로 판단해도 항상 로그인 화면을 향하게 되어 경쟁에서 어느 쪽이 이기든 결과가 같다.
 */
export default function RequireUser() {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const leavingToLogin = useAppStore((s) => s.leavingToLogin)
  if (isLoggedIn) return <Outlet />
  return <Navigate to={leavingToLogin ? paths.login : paths.welcome} replace />
}
