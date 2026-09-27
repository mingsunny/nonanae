// @vitest-environment jsdom
//
// Regression: 실제 브라우저에서 로그아웃/회원 탈퇴 후 로그인 화면이 아니라 인트로로 튕기는 문제.
// 원인: ProfilePage가 navigate(paths.login)을 부른 직후 currentUserId가 null이 되면서 RequireUser도
// 다시 렌더링돼 "로그인 안 됨"으로 보고 스스로 인트로(paths.welcome)로 리다이렉트를 시도했다.
// 두 리다이렉트가 경쟁하면 나중 것이 이겨서 인트로로 덮어써버릴 수 있었다(실제 브라우저에서 재현;
// jsdom 테스트 환경은 타이밍이 달라 드러나지 않았음). 고친 뒤에는 RequireUser 스스로도
// leavingToLogin 플래그를 보고 로그인 화면으로 판단하므로, 경쟁에서 어느 쪽이 이기든 결과가 같다.
// Found by /qa on 2026-09-27
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetMockData } from '../api'
import { useAppStore } from '../store/appStore'
import { paths } from './paths'
import RequireUser from './RequireUser'

function Protected() {
  return <div>보호된 화면</div>
}
function Login() {
  return <div>로그인 화면</div>
}
function Welcome() {
  return <div>인트로 화면</div>
}

function renderGuarded(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireUser />}>
          <Route path={paths.profile} element={<Protected />} />
        </Route>
        <Route path={paths.login} element={<Login />} />
        <Route path={paths.welcome} element={<Welcome />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAppStore.setState({ currentUserId: null, leavingToLogin: false })
})

afterEach(() => {
  cleanup()
})

describe('RequireUser', () => {
  it('로그인 상태면 보호된 화면을 그대로 보여준다', () => {
    useAppStore.setState({ currentUserId: 'u_1' })
    renderGuarded(paths.profile)
    expect(screen.getByText('보호된 화면')).toBeTruthy()
  })

  it('처음부터 로그인 안 된 상태(새로고침, 직접 URL 진입)면 인트로로 보낸다', () => {
    renderGuarded(paths.profile)
    expect(screen.getByText('인트로 화면')).toBeTruthy()
  })

  it('로그아웃/탈퇴로 leavingToLogin이 켜진 채 로그인 안 된 상태가 되면 인트로가 아니라 로그인 화면으로 보낸다', () => {
    useAppStore.setState({ currentUserId: null, leavingToLogin: true })
    renderGuarded(paths.profile)
    expect(screen.getByText('로그인 화면')).toBeTruthy()
    expect(screen.queryByText('인트로 화면')).toBeNull()
  })
})

describe('signOut/signUp/signIn과 leavingToLogin', () => {
  beforeEach(async () => {
    await resetMockData({ signedIn: false })
    useAppStore.setState({ status: 'idle' })
    await useAppStore.getState().init()
  })

  it('로그인한 정식 회원이 로그아웃하면 leavingToLogin을 켠다', async () => {
    await useAppStore.getState().signIn('a@naver.com', 'aaaaaaaa')
    await useAppStore.getState().signOut()
    expect(useAppStore.getState().leavingToLogin).toBe(true)
  })

  it('로그인 없이 참여한 게스트가 나가는 signOut은 leavingToLogin을 켜지 않는다 (RequireUser를 거치지 않고 이미 인트로로 직접 이동함)', async () => {
    await useAppStore.getState().signOut() // 이미 로그인 안 된 상태에서 그냥 signOut만 호출(게스트가 나가는 것과 동일)
    expect(useAppStore.getState().currentUserId).toBeNull()
    expect(useAppStore.getState().leavingToLogin).toBe(false)
  })

  it('회원 탈퇴는 leavingToLogin을 켠다', async () => {
    await useAppStore.getState().signIn('a@naver.com', 'aaaaaaaa')
    await useAppStore.getState().deleteAccount()
    expect(useAppStore.getState().leavingToLogin).toBe(true)
  })

  it('새로 로그인/가입하면 이전에 남아있던 leavingToLogin을 끈다', async () => {
    await useAppStore.getState().signIn('a@naver.com', 'aaaaaaaa')
    await useAppStore.getState().signOut()
    expect(useAppStore.getState().leavingToLogin).toBe(true) // 로그아웃 직후엔 켜져 있음

    await useAppStore.getState().signIn('a@naver.com', 'aaaaaaaa')
    expect(useAppStore.getState().leavingToLogin).toBe(false)
  })
})
