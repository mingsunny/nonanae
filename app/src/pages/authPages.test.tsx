// @vitest-environment jsdom
// 01~07, 14 화면 테스트: 실제 라우트 정의(routes)를 메모리 라우터에 올려서, 화면 이동과 로그인 가드까지 함께 확인한다.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createGroup,
  joinAsNewAccountMember,
  requestPasswordReset,
  resetMockData,
  signIn,
  signOut,
  signUp,
} from '../api'
import ToastHost from '../components/common/Toast'
import { routes } from '../routes/router'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'

/** 목업을 시드로 되돌리고 스토어를 다시 불러옴. loggedIn=false면 로그아웃 상태로 시작. */
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
const fill = (label: string, value: string) => userEvent.type(screen.getByLabelText(label), value)
const pathOf = (router: ReturnType<typeof renderApp>) => router.state.location.pathname
const state = () => useAppStore.getState()

/** 목업은 메일을 못 보내서 개발 중엔 콘솔에 링크를 찍는다 — 거기서 토큰을 꺼냄 */
async function requestResetToken(email: string): Promise<string> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  await requestPasswordReset(email)
  return String(info.mock.calls[0][0]).match(/token=([\w-]+)/)![1]
}

beforeEach(async () => {
  useToastStore.setState({ message: null })
  await boot({ loggedIn: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('01 인트로 / 로그인', () => {
  it('로그아웃 상태로 앱을 열면 인트로가 뜬다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/')
    expect(await screen.findByAltText('노나내')).toBeTruthy()
    expect(pathOf(router)).toBe('/login')
    for (const name of ['로그인', '회원가입', '초대코드로 가입하기']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('로그인이 필요한 화면(그룹 목록/프로필/그룹 생성)은 로그아웃 상태면 인트로로 보낸다', async () => {
    await boot({ loggedIn: false })
    for (const url of ['/groups', '/profile', '/groups/new']) {
      const router = renderApp(url)
      expect(await screen.findByAltText('노나내')).toBeTruthy()
      expect(pathOf(router)).toBe('/login')
      cleanup()
    }
  })

  it('테스트 계정으로 로그인하면 그룹 목록으로 간다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/login')
    await click('로그인')
    await fill('이메일', 'a@naver.com')
    await fill('비밀번호', 'aaaaaaaa')
    await click('로그인')
    expect(await screen.findByText('테스트님의 그룹')).toBeTruthy()
    expect(pathOf(router)).toBe('/groups')
  })

  it('이메일에 @가 없거나 비밀번호가 비어 있으면 로그인 버튼이 비활성이다', async () => {
    await boot({ loggedIn: false })
    renderApp('/login')
    await click('로그인')
    const submit = screen.getByRole('button', { name: '로그인' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    await fill('이메일', 'not-an-email')
    await fill('비밀번호', 'x')
    expect(submit.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('이메일'), '@x.com')
    expect(submit.disabled).toBe(false)
  })

  it('비밀번호가 틀리면 에러를 보여주고 화면에 머문다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/login')
    await click('로그인')
    await fill('이메일', 'a@naver.com')
    await fill('비밀번호', 'wrong-password')
    await click('로그인')
    expect((await screen.findByRole('alert')).textContent).toBe('이메일 또는 비밀번호가 일치하지 않아요.')
    expect(pathOf(router)).toBe('/login')
  })

  it('"초대코드로 가입하기"는 초대코드 입력 화면으로, "비밀번호를 잊으셨나요?"는 재설정 화면으로 간다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/login')
    await click('초대코드로 가입하기')
    expect(pathOf(router)).toBe('/join')
    cleanup()

    const router2 = renderApp('/login')
    await click('로그인')
    await userEvent.click(screen.getByRole('link', { name: '비밀번호를 잊으셨나요?' }))
    expect(pathOf(router2)).toBe('/password-reset')
  })
})

describe('01·02 회원가입 (2단계)', () => {
  async function goToSignup() {
    await boot({ loggedIn: false })
    const router = renderApp('/login')
    await click('회원가입')
    return router
  }

  async function fillStep1(email = 'new@example.com', password = 'pw-1234') {
    await fill('이메일', email)
    await fill('비밀번호', password)
    await fill('비밀번호 확인', password)
  }

  it('1단계 → 2단계를 마치면 계정이 만들어지고 로그인된 채로 그룹 목록에 들어간다. 첫 그룹 안내가 뜬다', async () => {
    const router = await goToSignup()
    await fillStep1()
    await click('다음')

    expect(await screen.findByText(/이름과 계좌 정보를 등록해주세요/)).toBeTruthy()
    await fill('이름', '신규')
    await userEvent.selectOptions(screen.getByLabelText('은행'), '토스뱅크')
    await fill('계좌번호', '1000-1234-5678')
    await click('회원가입')

    expect(await screen.findByText('신규님의 그룹')).toBeTruthy()
    expect(pathOf(router)).toBe('/groups')
    expect(screen.getByText('그룹을 만들고 정산을 시작해요')).toBeTruthy()
    expect(state().usersById[state().currentUserId!]).toMatchObject({ email: 'new@example.com', bank: '토스뱅크' })
  })

  it('비밀번호 확인이 다르면 안내 문구가 뜨고 "다음"이 비활성이다', async () => {
    await goToSignup()
    await fill('이메일', 'new@example.com')
    await fill('비밀번호', 'pw-1234')
    await fill('비밀번호 확인', 'pw-9999')
    expect(screen.getByText('비밀번호가 일치하지 않아요.')).toBeTruthy()
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)

    await userEvent.clear(screen.getByLabelText('비밀번호 확인'))
    await fill('비밀번호 확인', 'pw-1234')
    expect(screen.getByText('비밀번호가 일치해요.')).toBeTruthy()
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('이미 가입된 이메일이면 1단계에서 막는다', async () => {
    await goToSignup()
    await fillStep1('a@naver.com')
    await click('다음')
    expect((await screen.findByRole('alert')).textContent).toBe('이미 가입된 이메일이에요. 로그인해주세요.')
    expect(screen.queryByText(/이름과 계좌 정보를 등록해주세요/)).toBeNull()
  })

  it('2단계에서 뒤로 가면 1단계 입력값이 남아 있다', async () => {
    await goToSignup()
    await fillStep1()
    await click('다음')
    await screen.findByText(/이름과 계좌 정보를 등록해주세요/)
    await click('뒤로가기')
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('new@example.com')
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).value).toBe('pw-1234')
  })

  it('2단계는 이름·은행·계좌번호가 모두 채워져야 "회원가입"이 활성화된다', async () => {
    await goToSignup()
    await fillStep1()
    await click('다음')
    const submit = (await screen.findByRole('button', { name: '회원가입' })) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    await fill('이름', '신규')
    await fill('계좌번호', '1000')
    expect(submit.disabled).toBe(true)
    await userEvent.selectOptions(screen.getByLabelText('은행'), '카카오뱅크')
    expect(submit.disabled).toBe(false)
  })

  it('로그인 화면에 입력해 둔 이메일이 회원가입 1단계로 이어진다', async () => {
    await boot({ loggedIn: false })
    renderApp('/login')
    await click('로그인')
    await fill('이메일', 'keep@example.com')
    await click('뒤로가기')
    await click('회원가입')
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('keep@example.com')
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).value).toBe('')
  })
})

describe('03 그룹 목록', () => {
  it('내 그룹과 멤버 수·총 지출을 보여주고, 그룹이 있으면 첫 그룹 안내는 뜨지 않는다', async () => {
    const router = renderApp('/groups')
    expect(await screen.findByText('테스트님의 그룹')).toBeTruthy()
    expect(screen.getByText('제주도 여행')).toBeTruthy()
    expect(screen.getByText('멤버 4명 · 총 ₩958,000')).toBeTruthy()
    expect(screen.queryByText('그룹을 만들고 정산을 시작해요')).toBeNull()

    await userEvent.click(screen.getByRole('link', { name: /제주도 여행/ }))
    expect(pathOf(router)).toBe('/groups/g_jeju/expenses')
  })

  it('가장 최근에 만들거나 참여한 그룹이 위에 나온다', async () => {
    await createGroup('부산 여행')
    await new Promise((resolve) => setTimeout(resolve, 5)) // 같은 밀리초에 들어온 것으로 겹치지 않게
    await joinAsNewAccountMember('g_test42')
    await state().refresh()

    renderApp('/groups')
    await screen.findByText('테스트님의 그룹')

    // 만든 순서(제주도 → 부산)나 그룹 생성 순서가 아니라, 내가 가장 나중에 들어온 그룹(초대코드 테스트방)부터
    const names = screen.getAllByRole('link').map((l) => l.textContent ?? '')
    const order = ['초대코드 테스트방', '부산 여행', '제주도 여행'].map((n) => names.findIndex((t) => t.includes(n)))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('"초대코드 입력"은 초대코드 화면으로 간다', async () => {
    const router = renderApp('/groups')
    await click('초대코드 입력')
    expect(pathOf(router)).toBe('/join')
  })

  it('그룹이 없는 신규 회원에게 안내가 뜨고, "새 그룹 만들기"를 누르면 다시는 안 뜬다', async () => {
    await resetMockData()
    await signOut()
    await signUp({ email: 'new@example.com', password: 'pw', name: '신규', bank: '토스뱅크', account: '1' })
    useAppStore.setState({ status: 'idle' })
    await state().init()

    const router = renderApp('/groups')
    expect(await screen.findByText('그룹을 만들고 정산을 시작해요')).toBeTruthy()

    await click('＋ 새 그룹 만들기')
    await waitFor(() => expect(pathOf(router)).toBe('/groups/new'))
    await router.navigate('/groups')
    expect(await screen.findByText('신규님의 그룹')).toBeTruthy()
    expect(screen.queryByText('그룹을 만들고 정산을 시작해요')).toBeNull()
  })

  it('하단 탭바로 프로필 탭에 갔다 올 수 있다', async () => {
    const router = renderApp('/groups')
    await userEvent.click(await screen.findByRole('link', { name: '프로필' }))
    expect(pathOf(router)).toBe('/profile')
    expect(screen.getByText('이메일 계정으로 로그인함')).toBeTruthy()
    await userEvent.click(screen.getByRole('link', { name: '홈' }))
    expect(pathOf(router)).toBe('/groups')
  })
})

describe('04 프로필', () => {
  it('현재 값이 채워져 있고, 값을 바꿔야 저장 버튼이 활성화된다. 저장하면 인사말도 바뀐다', async () => {
    renderApp('/profile')
    const name = (await screen.findByLabelText('이름')) as HTMLInputElement
    expect(name.value).toBe('테스트')
    expect((screen.getByLabelText('은행') as HTMLSelectElement).value).toBe('카카오뱅크')
    expect((screen.getByLabelText('계좌번호') as HTMLInputElement).value).toBe('3333-01-9999999')

    const save = screen.getByRole('button', { name: '저장하기' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    await userEvent.clear(name)
    expect(save.disabled).toBe(true) // 비어 있으면 저장 불가
    await userEvent.type(name, '새이름')
    expect(save.disabled).toBe(false)

    await userEvent.click(save)
    expect(await screen.findByText('프로필이 저장되었습니다')).toBeTruthy()
    expect(screen.getByText('새이름님의 그룹')).toBeTruthy()
    expect(save.disabled).toBe(true) // 저장 직후 다시 비활성
  })

  it('로그아웃하면 인트로가 아니라 로그인 화면으로 간다', async () => {
    const router = renderApp('/profile')
    await click('로그아웃')
    expect(await screen.findByLabelText('비밀번호')).toBeTruthy()
    expect(pathOf(router)).toBe('/login')
    expect(screen.queryByAltText('노나내')).toBeNull()
    await waitFor(() => expect(state().currentUserId).toBeNull())
  })

  it('회원 탈퇴는 확인창에서 취소하면 아무 일도 없고, 확인하면 계정이 지워지고 로그인 화면으로 간다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const router = renderApp('/profile')
    await click('회원 탈퇴')
    expect(confirm).toHaveBeenCalledWith('정말 탈퇴하시겠어요? 계정 정보가 삭제돼요.')
    expect(pathOf(router)).toBe('/profile')
    expect(state().currentUserId).toBe('u_test')

    confirm.mockReturnValue(true)
    await click('회원 탈퇴')
    expect(await screen.findByLabelText('비밀번호')).toBeTruthy()
    expect(pathOf(router)).toBe('/login')
    await waitFor(() => expect(state().currentUserId).toBeNull())
    await expect(signIn('a@naver.com', 'aaaaaaaa')).rejects.toThrow()
  })
})

describe('05 새 그룹 만들기', () => {
  it('이름이 비어 있으면 만들 수 없고, 만들면 멤버 초대(12) 화면으로 간다 (뒤로가기 없이 "그룹으로 가기"만)', async () => {
    const router = renderApp('/groups/new')
    const submit = (await screen.findByRole('button', { name: '그룹 만들기' })) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    await fill('그룹(여행) 이름', '   ')
    expect(submit.disabled).toBe(true)

    await fill('그룹(여행) 이름', '부산 여행')
    await userEvent.click(submit)

    expect(await screen.findByText('멤버 목록')).toBeTruthy()
    expect(pathOf(router)).toMatch(/^\/groups\/g_\w+\/members$/)
    expect(screen.queryByRole('link', { name: '그룹으로' })).toBeNull()
    const created = state().groups.find((g) => g.name === '부산 여행')!
    expect(created.members).toHaveLength(1)

    await click('그룹으로 가기')
    expect(pathOf(router)).toBe(`/groups/${created.id}/expenses`)
    expect(await screen.findByText('부산 여행')).toBeTruthy()
    expect(screen.getByText('정산할 친구를 초대해주세요.')).toBeTruthy()
  })

  it('뒤로가기는 그룹 목록으로 간다', async () => {
    const router = renderApp('/groups/new')
    await userEvent.click(await screen.findByRole('link', { name: '뒤로가기' }))
    expect(pathOf(router)).toBe('/groups')
  })
})

describe('06·07 초대코드로 참여', () => {
  it('4자 미만이면 다음 버튼이 비활성이고, 없는 코드는 에러를 보여준다', async () => {
    await boot({ loggedIn: false })
    renderApp('/join')
    const next = (await screen.findByRole('button', { name: '다음' })) as HTMLButtonElement
    await fill('초대코드', 'AB')
    expect(next.disabled).toBe(true)
    await fill('초대코드', 'CD99')
    expect(next.disabled).toBe(false)
    await userEvent.click(next)
    expect((await screen.findByRole('alert')).textContent).toBe('일치하는 그룹을 찾을 수 없어요. 코드를 다시 확인해주세요.')
  })

  it('공용 코드(비로그인)는 멤버 목록에서 나를 고르면 그 자리로 그룹에 들어간다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/join')
    await fill('초대코드', 'test42')
    await click('다음')

    expect(await screen.findByText('[초대코드 테스트방] 그룹에 참여해요. 본인이 누구인지 골라주세요.')).toBeTruthy()
    expect(screen.getByText('이미 가입됨')).toBeTruthy()
    expect(screen.getByText('방장데모')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /김민지/ }))
    await waitFor(() => expect(pathOf(router)).toBe('/groups/g_test42/expenses'))
    expect(state().viewAsMemberId).toBe('m_minji')
    expect(state().currentUserId).toBeNull()
  })

  it('공용 코드(비로그인)로 목록에 없으면 이름만 입력해 새로 참여한다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/join')
    await fill('초대코드', 'TEST42')
    await click('다음')

    const join = (await screen.findByRole('button', { name: '이 이름으로 참여하기' })) as HTMLButtonElement
    expect(join.disabled).toBe(true)
    await fill('목록에 없으면 이름을 입력해주세요', '이서준')
    await userEvent.click(join)

    await waitFor(() => expect(pathOf(router)).toBe('/groups/g_test42/expenses'))
    const group = state().groups.find((g) => g.id === 'g_test42')!
    expect(group.members.find((m) => m.name === '이서준')).toMatchObject({ userId: null, role: 'member' })
  })

  it('공용 코드(로그인)는 "새 멤버로 참여하기"로 내 계정을 멤버로 추가한다', async () => {
    const router = renderApp('/join')
    await fill('초대코드', 'TEST42')
    await click('다음')
    await click('새 멤버로 참여하기')
    await waitFor(() => expect(pathOf(router)).toBe('/groups/g_test42/expenses'))
    expect(state().groups.find((g) => g.id === 'g_test42')!.members.some((m) => m.userId === 'u_test')).toBe(true)
  })

  it('개인 초대 링크(?code=코드-멤버ID)로 들어오면 목록 없이 그 자리에 바로 연결되고 안내가 뜬다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/join?code=TEST42-m_minji')
    expect(await screen.findByText('김민지님으로 참여했어요')).toBeTruthy()
    await waitFor(() => expect(pathOf(router)).toBe('/groups/g_test42/expenses'))
    expect(state().viewAsMemberId).toBe('m_minji')
  })

  it('공용 링크(?code=코드)로 들어오면 코드를 채우고 바로 확인해 멤버 목록을 보여준다', async () => {
    await boot({ loggedIn: false })
    renderApp('/join?code=TEST42')
    expect(await screen.findByText('[초대코드 테스트방] 그룹에 참여해요. 본인이 누구인지 골라주세요.')).toBeTruthy()
  })

  it('링크의 코드가 잘못됐으면 코드를 채운 채로 에러를 보여준다', async () => {
    await boot({ loggedIn: false })
    renderApp('/join?code=NOPE99')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByLabelText('초대코드') as HTMLInputElement).value).toBe('NOPE99')
  })

  it('이미 멤버인 그룹의 코드는 안내 없이 바로 그룹으로 간다', async () => {
    const router = renderApp('/join?code=JEJU26')
    await waitFor(() => expect(pathOf(router)).toBe('/groups/g_jeju/expenses'))
  })

  it('목록 화면에서 뒤로 가면 코드 입력으로, 코드 입력에서 뒤로 가면 로그인 상태에 따라 목록/인트로로 간다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/join')
    await fill('초대코드', 'TEST42')
    await click('다음')
    await screen.findByText(/본인이 누구인지/)
    await click('뒤로가기')
    expect(await screen.findByLabelText('초대코드')).toBeTruthy()
    await click('뒤로가기')
    expect(pathOf(router)).toBe('/login')
    cleanup()

    await boot({ loggedIn: true })
    const router2 = renderApp('/join')
    await click('뒤로가기')
    expect(pathOf(router2)).toBe('/groups')
  })

  it('게스트가 그룹에서 뒤로가기를 누르면 세션을 끝내고 인트로로 나간다', async () => {
    await boot({ loggedIn: false })
    const router = renderApp('/join?code=TEST42-m_minji')
    await waitFor(() => expect(pathOf(router)).toBe('/groups/g_test42/expenses'))
    await userEvent.click(await screen.findByRole('button', { name: '나가기' }))
    expect(await screen.findByAltText('노나내')).toBeTruthy()
    expect(pathOf(router)).toBe('/login')
    await waitFor(() => expect(state().viewAsMemberId).toBeNull())
  })
})

describe('14 비밀번호 재설정', () => {
  const linkSentGuide = '입력하신 이메일로 재설정 링크를 보냈어요. 메일함을 확인해주세요.'

  it('링크를 보내면 로그인 화면으로 돌아가 안내를 띄운다. 가입된 이메일이든 아니든 같은 안내다', async () => {
    for (const email of ['a@naver.com', 'nobody@example.com']) {
      vi.spyOn(console, 'info').mockImplementation(() => {})
      const router = renderApp('/password-reset')
      await fill('이메일', email)
      await click('재설정 링크 보내기')
      expect(await screen.findByText(linkSentGuide)).toBeTruthy()
      expect(pathOf(router)).toBe('/login')
      expect(screen.getByLabelText('비밀번호')).toBeTruthy() // 인트로가 아니라 로그인 화면
      cleanup()
    }
  })

  it('로그인 화면의 재설정 안내는 화면을 벗어났다 돌아오면 사라진다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    renderApp('/password-reset')
    await fill('이메일', 'a@naver.com')
    await click('재설정 링크 보내기')
    await screen.findByText(linkSentGuide)
    await click('뒤로가기')
    await click('로그인')
    expect(screen.queryByText(linkSentGuide)).toBeNull()
  })

  it('링크로 들어와 새 비밀번호를 정하면 로그인 화면으로 가고, 새 비밀번호로 로그인된다', async () => {
    const token = await requestResetToken('a@naver.com')
    const router = renderApp(`/password-reset?token=${token}`)

    const change = (await screen.findByRole('button', { name: '비밀번호 변경' })) as HTMLButtonElement
    expect(change.disabled).toBe(true)
    await fill('새 비밀번호', 'brand-new')
    await fill('비밀번호 확인', 'brand-new')
    expect(screen.getByText('비밀번호가 일치해요.')).toBeTruthy()
    await userEvent.click(change)

    expect(await screen.findByText('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.')).toBeTruthy()
    expect(pathOf(router)).toBe('/login')
    expect(await screen.findByLabelText('비밀번호')).toBeTruthy()
    await signOut()
    await expect(signIn('a@naver.com', 'brand-new')).resolves.toMatchObject({ id: 'u_test' })
  })

  it('확인 값이 다르면 변경할 수 없다', async () => {
    const token = await requestResetToken('a@naver.com')
    renderApp(`/password-reset?token=${token}`)
    const change = (await screen.findByRole('button', { name: '비밀번호 변경' })) as HTMLButtonElement
    await fill('새 비밀번호', 'one')
    await fill('비밀번호 확인', 'two')
    expect(screen.getByText('비밀번호가 일치하지 않아요.')).toBeTruthy()
    expect(change.disabled).toBe(true)
  })

  it('만료되었거나 이미 쓴 링크는 안내하고, 다시 받기를 누르면 이메일 입력으로 돌아간다', async () => {
    const router = renderApp('/password-reset?token=expired-token')
    expect(await screen.findByText(/링크가 만료되었거나 이미 사용됐어요/)).toBeTruthy()
    await click('재설정 링크 다시 받기')
    expect(await screen.findByRole('button', { name: '재설정 링크 보내기' })).toBeTruthy()
    expect(router.state.location.search).toBe('')
  })
})
