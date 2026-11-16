import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isTossBuild } from '../lib/platform'
import { useAppStore } from '../store/appStore'
import { paths } from './paths'

/**
 * 웹에서만 쓰는 화면(이메일 로그인·가입·가입 확인·비밀번호 재설정/변경)을 감싼다.
 * 토스 미니앱은 토스 로그인만 쓰므로(앱인토스 정책) 이런 주소로 들어오면 로그인 상태면 그룹 목록, 아니면 인트로로 보낸다.
 */
export default function WebOnly({ children }: { children: ReactNode }) {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  if (isTossBuild()) return <Navigate to={isLoggedIn ? paths.groups : paths.welcome} replace />
  return children
}
