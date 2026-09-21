import type { AuthError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 진짜 Supabase에는 연결하지 않고, 클라이언트를 가짜로 바꿔 "우리 코드가 무엇을 보내고 결과를 어떻게 해석하는지"만 검증한다.
const mocks = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  USE_SUPABASE: true,
  getSupabase: () => ({ auth: mocks.auth, from: mocks.from }),
}))

import { authErrorMessage, fetchSnapshot, markGroupCreateCoachSeen, signIn, signOut, signUp, updateProfile } from './supabaseApi'

const authUser = {
  id: 'user-1',
  email: 'me@example.com',
  email_confirmed_at: '2026-09-21T00:00:00Z',
  is_anonymous: false,
}
const profileRow = { id: 'user-1', name: '민선', bank: '카카오뱅크', account: '3333-01-1', seen_group_create_coach: false }

const signedInSession = { data: { session: { user: authUser } } }
const noSession = { data: { session: null } }

function authError(code: string): AuthError {
  return { code, message: `raw ${code}`, name: 'AuthApiError', status: 400 } as unknown as AuthError
}

/** from('profiles').select().eq().maybeSingle() 가 result를 돌려주게 한다 */
function mockProfileRead(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  mocks.from.mockReturnValueOnce({ select })
  return { select, eq }
}

/** from('profiles').update(values).eq('id', ...) 가 result를 돌려주게 한다 */
function mockProfileUpdate(result: { error: unknown } = { error: null }) {
  const eq = vi.fn().mockResolvedValue(result)
  const update = vi.fn(() => ({ eq }))
  mocks.from.mockReturnValueOnce({ update })
  return { update, eq }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('authErrorMessage', () => {
  it('로그인 실패는 계정 존재 여부를 알려주지 않는 한 가지 문구로 통일한다', () => {
    expect(authErrorMessage(authError('invalid_credentials'))).toBe('이메일 또는 비밀번호가 일치하지 않아요.')
  })

  it('이미 가입된 이메일을 알려준다', () => {
    expect(authErrorMessage(authError('user_already_exists'))).toBe('이미 가입된 이메일이에요. 로그인해주세요.')
    expect(authErrorMessage(authError('email_exists'))).toBe('이미 가입된 이메일이에요. 로그인해주세요.')
  })

  it('모르는 에러는 원문 대신 일반 문구를 보여주고 콘솔에만 남긴다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(authErrorMessage(authError('something_new'))).toBe('요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('signIn', () => {
  it('로그인하고 auth 계정 + 프로필을 합친 User를 돌려준다', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: null })
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockProfileRead({ data: profileRow, error: null })

    const user = await signIn(' me@example.com ', 'pw-12345')

    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.com', password: 'pw-12345' })
    expect(user).toEqual({
      id: 'user-1',
      authProvider: 'email',
      email: 'me@example.com',
      emailVerified: true,
      name: '민선',
      bank: '카카오뱅크',
      account: '3333-01-1',
      seenGroupCreateCoach: false,
    })
  })

  it('잘못된 비밀번호면 한국어 에러로 던진다', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: authError('invalid_credentials') })
    await expect(signIn('me@example.com', 'wrong')).rejects.toThrow('이메일 또는 비밀번호가 일치하지 않아요.')
  })
})

describe('signUp', () => {
  const input = { email: 'new@example.com', password: 'pw-12345', name: ' 신규 ', bank: '토스뱅크', account: ' 1000-1 ' }

  it('이름·은행·계좌를 auth 메타데이터로 보내고, 가입 후 User를 돌려준다', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...authUser, identities: [{}] }, session: {} }, error: null })
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockProfileRead({ data: { ...profileRow, name: '신규' }, error: null })

    const user = await signUp(input)

    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'pw-12345',
      options: { data: { name: '신규', bank: '토스뱅크', account: '1000-1' } },
    })
    expect(user.name).toBe('신규')
  })

  it('이메일 확인이 켜져 있을 때 이미 가입된 이메일은 identities가 비어서 온다', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...authUser, identities: [] }, session: null }, error: null })
    await expect(signUp(input)).rejects.toThrow('이미 가입된 이메일이에요. 로그인해주세요.')
  })

  it('세션이 없으면(이메일 확인 대기) 확인 메일 안내로 던진다', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...authUser, identities: [{}] }, session: null }, error: null })
    await expect(signUp(input)).rejects.toThrow('가입 확인 메일을 보냈어요')
  })

  it('이름·은행·계좌가 비어 있으면 서버를 부르기 전에 막는다', async () => {
    await expect(signUp({ ...input, bank: '' })).rejects.toThrow('이름, 은행, 계좌번호를 모두 입력해주세요')
    expect(mocks.auth.signUp).not.toHaveBeenCalled()
  })
})

describe('fetchSnapshot', () => {
  it('로그인하지 않았으면 세션이 비어 있다', async () => {
    mocks.auth.getSession.mockResolvedValue(noSession)
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: null })
    expect(snapshot.users).toEqual([])
  })

  it('로그인했으면 내 프로필을 users에 담는다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockProfileRead({ data: profileRow, error: null })
    const snapshot = await fetchSnapshot()
    expect(snapshot.session.userId).toBe('user-1')
    expect(snapshot.users.map((u) => u.name)).toEqual(['민선'])
  })

  it('게스트(익명) 세션은 정식 회원으로 보지 않는다', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: { user: { ...authUser, is_anonymous: true } } } })
    const snapshot = await fetchSnapshot()
    expect(snapshot.session.userId).toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('세션은 있는데 프로필이 없으면 로그아웃 상태로 본다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockProfileRead({ data: null, error: null })
    expect((await fetchSnapshot()).session.userId).toBeNull()
  })
})

describe('updateProfile', () => {
  it('공백을 다듬어서 내 프로필 행만 수정한다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    const { update, eq } = mockProfileUpdate()
    mockProfileRead({ data: { ...profileRow, name: '새이름' }, error: null })

    const user = await updateProfile({ name: ' 새이름 ', bank: '국민은행', account: ' 123-456 ' })

    expect(update).toHaveBeenCalledWith({ name: '새이름', bank: '국민은행', account: '123-456' })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
    expect(user.name).toBe('새이름')
  })

  it('로그인하지 않았으면 저장하지 않는다', async () => {
    mocks.auth.getSession.mockResolvedValue(noSession)
    await expect(updateProfile({ name: 'a', bank: 'b', account: 'c' })).rejects.toThrow('로그인이 필요해요')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('markGroupCreateCoachSeen / signOut', () => {
  it('안내를 본 것으로 표시한다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    const { update, eq } = mockProfileUpdate()
    await markGroupCreateCoachSeen()
    expect(update).toHaveBeenCalledWith({ seen_group_create_coach: true })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('로그아웃한다', async () => {
    mocks.auth.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mocks.auth.signOut).toHaveBeenCalled()
  })
})
