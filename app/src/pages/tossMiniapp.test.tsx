// @vitest-environment jsdom
// 토스 미니앱 빌드(VITE_TARGET=toss) 전용 동작: 토스 로그인만, 게스트(로그인 없이) 참여 없음, 이메일 화면 막기, 토스 공유 링크.
// 토스 SDK는 토스 앱 안에서만 동작해서 lib/toss를 통째로 가짜로 바꾼다.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetMockData, signOut } from '../api'
import ToastHost from '../components/common/Toast'
import { routes } from '../routes/router'
import { useAppStore } from '../store/appStore'
import { useAuthFlowStore } from '../store/authFlowStore'
import { useToastStore } from '../store/toastStore'

const toss = vi.hoisted(() => ({
  requestTossLogin: vi.fn(async () => ({ authorizationCode: 'code-1', referrer: 'DEFAULT' })),
  createTossShareLink: vi.fn(async (path: string) => `https://toss.im/share?to=${encodeURIComponent(path)}`),
  openTossShareSheet: vi.fn(async () => {}),
}))
vi.mock('../lib/toss', () => toss)

async function boot({ loggedIn }: { loggedIn: boolean }) {
  await resetMockData()
  if (!loggedIn) await signOut()
  useAppStore.setState({ status: 'idle' })
  await useAppStore.getState().init()
}

function renderApp(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] })
  render(
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>,
  )
  return router
}

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }))
const urlOf = (router: ReturnType<typeof renderApp>) => router.state.location.pathname + router.state.location.search

/** 토스로 시작하기 → (처음이라) 이름·계좌 등록까지 */
async function tossLoginAndRegister() {
  await click('토스로 시작하기')
  expect(await screen.findByText(/이름과 계좌 정보를 등록해주세요/)).toBeTruthy()
  await userEvent.type(screen.getByLabelText('이름'), '토스')
  await userEvent.selectOptions(screen.getByLabelText('은행'), '토스뱅크')
  await userEvent.type(screen.getByLabelText('계좌번호'), '1000-1234-5678')
  await click('가입 완료')
}

beforeEach(() => {
  vi.stubEnv('VITE_TARGET', 'toss')
  localStorage.setItem('nonanae.onboardingSeen', '1')
  useToastStore.setState({ message: null })
  useAuthFlowStore.getState().reset()
  toss.requestTossLogin.mockClear()
  toss.createTossShareLink.mockClear()
  toss.openTossShareSheet.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('토스 미니앱: 로그인', () => {
  it('인트로에는 "토스로 시작하기"만 있고, 이메일 로그인·가입·초대코드(게스트) 참여·의견 보내기는 없다', async () => {
    await boot({ loggedIn: false })
    renderApp('/welcome')
    expect(await screen.findByRole('button', { name: '토스로 시작하기' })).toBeTruthy()
    for (const name of ['로그인', '회원가입', '초대코드로 가입하기']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(screen.queryByText('의견 보내기')).toBeNull()
    // 들어오자마자 토스 로그인 창을 띄우지 않는다 (앱인토스 UX 정책)
    expect(toss.requestTossLogin).not.toHaveBeenCalled()
  })

  it('토스로 시작하기 → 처음이면 이름·계좌 등록 → 그룹 목록', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/welcome')
    await tossLoginAndRegister()
    expect(await screen.findByText('토스님의 그룹')).toBeTruthy()
    expect(urlOf(router)).toBe('/groups')
    expect(toss.requestTossLogin).toHaveBeenCalledTimes(1)
  })

  it('로그아웃하면 인트로(토스로 시작하기)로 간다', async () => {
    await boot({ loggedIn: true })
    const router = renderApp('/profile')
    await click('로그아웃')
    expect(await screen.findByRole('button', { name: '토스로 시작하기' })).toBeTruthy()
    expect(urlOf(router)).toBe('/welcome')
  })

  it('토스 로그인을 취소하거나 실패하면 인트로에 남고 안내가 뜬다', async () => {
    await boot({ loggedIn: false })
    toss.requestTossLogin.mockRejectedValueOnce(new Error('사용자가 취소했어요'))
    const router = renderApp('/welcome')
    await click('토스로 시작하기')
    expect(await screen.findByText('사용자가 취소했어요')).toBeTruthy()
    expect(urlOf(router)).toBe('/welcome')
    expect(screen.getByRole('button', { name: '토스로 시작하기' })).toBeTruthy()
  })

  it('이메일 로그인·가입·비밀번호 재설정 주소로 들어오면 인트로로 보낸다', async () => {
    await boot({ loggedIn: false })
    for (const url of ['/login', '/signup', '/signup/confirm', '/password-reset']) {
      const router = renderApp(url)
      expect(await screen.findByRole('button', { name: '토스로 시작하기' })).toBeTruthy()
      expect(urlOf(router)).toBe('/welcome')
      cleanup()
    }
  })
})

describe('토스 미니앱: 초대 링크로 참여', () => {
  it('로그인 없이 초대 링크로 들어오면 게스트 참여 대신 토스 로그인을 거쳐 그 초대 화면으로 돌아간다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/join?code=TEST42')
    expect(await screen.findByRole('button', { name: '토스로 시작하기' })).toBeTruthy()
    expect(urlOf(router)).toBe('/welcome')

    await tossLoginAndRegister()
    await waitFor(() => expect(urlOf(router)).toBe('/join?code=TEST42'))
    expect(await screen.findByText(/초대코드 테스트방/)).toBeTruthy()
  })

  it('"초대 링크 복사"는 토스 공유 링크(intoss://)를 만들어 토스 공유 시트를 연다', async () => {
    await boot({ loggedIn: true })
    renderApp('/groups/g_jeju/expenses')
    await click('초대 링크 복사')
    await waitFor(() => expect(toss.openTossShareSheet).toHaveBeenCalledTimes(1))
    expect(toss.createTossShareLink).toHaveBeenCalledWith('/join?code=JEJU26')
    const sheet = toss.openTossShareSheet.mock.calls[0] as unknown as [string]
    expect(sheet[0]).toContain('제주도 여행')
    expect(sheet[0]).toContain('https://toss.im/share?to=')
  })
})

describe('토스 미니앱: 프로필', () => {
  it('비밀번호가 없으니 "비밀번호 변경"이 없고, 비밀번호 변경 주소는 그룹 목록으로 보낸다', async () => {
    await boot({ loggedIn: true })
    renderApp('/profile')
    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '비밀번호 변경' })).toBeNull()
    expect(screen.queryByText('의견 보내기')).toBeNull()
    cleanup()

    const router = renderApp('/profile/password')
    await waitFor(() => expect(urlOf(router)).toBe('/groups'))
  })
})
