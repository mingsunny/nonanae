import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createGroup,
  deleteAccount,
  fetchSnapshot,
  isEmailTaken,
  isPasswordResetTokenValid,
  joinAsExistingMember,
  joinAsNewAccountMember,
  joinAsNewGuest,
  markGroupCreateCoachSeen,
  requestPasswordReset,
  resetMockData,
  resetPassword,
  resolveInviteCode,
  signIn,
  signOut,
  signUp,
  updateProfile,
} from './index'

const newUser = { email: 'new@example.com', password: 'pw-1234', name: '신규', bank: '토스뱅크', account: '1000-1' }

beforeEach(async () => {
  await resetMockData()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('signIn', () => {
  it('테스트 계정으로 로그인하면 세션이 그 계정이 된다', async () => {
    await signOut()
    const user = await signIn('a@naver.com', 'aaaaaaaa')
    expect(user.id).toBe('u_test')
    expect((await fetchSnapshot()).session.userId).toBe('u_test')
  })

  it('이메일은 대소문자·앞뒤 공백을 무시한다', async () => {
    await signOut()
    await expect(signIn('  A@Naver.com ', 'aaaaaaaa')).resolves.toMatchObject({ id: 'u_test' })
  })

  it('비밀번호가 틀리든 가입 안 된 이메일이든 같은 메시지로 실패한다 (계정 존재 여부 노출 방지)', async () => {
    await signOut()
    const message = '이메일 또는 비밀번호가 일치하지 않아요.'
    await expect(signIn('a@naver.com', 'wrong')).rejects.toThrow(message)
    await expect(signIn('nobody@example.com', 'aaaaaaaa')).rejects.toThrow(message)
    expect((await fetchSnapshot()).session.userId).toBeNull()
  })
})

describe('signUp / isEmailTaken', () => {
  it('가입하면 바로 로그인 상태가 되고, 그룹은 없고, 안내(coach)는 아직 안 본 상태다', async () => {
    const user = await signUp(newUser)
    expect(user).toMatchObject({ email: 'new@example.com', name: '신규', authProvider: 'email', seenGroupCreateCoach: false })
    const snapshot = await fetchSnapshot()
    expect(snapshot.session.userId).toBe(user.id)
    expect(snapshot.groups).toEqual([])
    // 그룹이 없어도 내 정보는 읽을 수 있어야 함 (03 인사말, 04 프로필)
    expect(snapshot.users.map((u) => u.id)).toEqual([user.id])
  })

  it('가입한 계정으로 다시 로그인할 수 있다', async () => {
    await signUp(newUser)
    await signOut()
    await expect(signIn('new@example.com', 'pw-1234')).resolves.toMatchObject({ name: '신규' })
  })

  it('이미 가입된 이메일이면 실패하고, isEmailTaken도 true를 돌려준다', async () => {
    expect(await isEmailTaken('A@naver.com')).toBe(true)
    expect(await isEmailTaken('new@example.com')).toBe(false)
    await expect(signUp({ ...newUser, email: 'a@naver.com' })).rejects.toThrow('이미 가입된 이메일이에요')
  })

  it('이름·은행·계좌 중 하나라도 비면 실패한다', async () => {
    await expect(signUp({ ...newUser, name: '  ' })).rejects.toThrow('모두 입력')
    await expect(signUp({ ...newUser, bank: '' })).rejects.toThrow('모두 입력')
    await expect(signUp({ ...newUser, account: '' })).rejects.toThrow('모두 입력')
    expect(await isEmailTaken('new@example.com')).toBe(false)
  })
})

describe('signOut / deleteAccount', () => {
  it('로그아웃하면 세션이 비고 내 그룹이 안 보인다', async () => {
    await signOut()
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: null })
    expect(snapshot.groups).toEqual([])
  })

  it('탈퇴하면 그 계정으로 로그인할 수 없다. 그룹의 멤버 자리는 남고 이름만 빈 값이 된다 (04 예외처리)', async () => {
    await deleteAccount()
    await expect(signIn('a@naver.com', 'aaaaaaaa')).rejects.toThrow()
    const resolution = await resolveInviteCode('JEJU26')
    if (resolution.kind !== 'pick') throw new Error('pick이어야 함')
    expect(resolution.candidates.find((c) => c.id === 'm_me')).toEqual({ id: 'm_me', name: '', hasAccount: true })
  })

  it('로그인하지 않은 상태로는 탈퇴할 수 없다', async () => {
    await signOut()
    await expect(deleteAccount()).rejects.toThrow('로그인이 필요해요')
  })
})

describe('updateProfile / markGroupCreateCoachSeen', () => {
  it('저장하면 이름·은행·계좌가 바뀌고 앞뒤 공백은 잘린다', async () => {
    await updateProfile({ name: ' 새이름 ', bank: '국민은행', account: ' 111-222 ' })
    const me = (await fetchSnapshot()).users.find((u) => u.id === 'u_test')!
    expect(me).toMatchObject({ name: '새이름', bank: '국민은행', account: '111-222' })
  })

  it('빈 값이 있으면 저장하지 않는다', async () => {
    await expect(updateProfile({ name: '', bank: '국민은행', account: '1' })).rejects.toThrow('모두 입력')
    expect((await fetchSnapshot()).users.find((u) => u.id === 'u_test')!.name).toBe('테스트')
  })

  it('첫 그룹 안내를 본 것으로 처리한다', async () => {
    expect((await fetchSnapshot()).users.find((u) => u.id === 'u_test')!.seenGroupCreateCoach).toBe(false)
    await markGroupCreateCoachSeen()
    expect((await fetchSnapshot()).users.find((u) => u.id === 'u_test')!.seenGroupCreateCoach).toBe(true)
  })
})

describe('createGroup', () => {
  it('만든 사람이 owner 멤버가 되고, 지출 없는 빈 그룹으로 시작하며, 6자리 초대코드가 생긴다', async () => {
    const group = await createGroup('  부산 여행  ')
    expect(group.name).toBe('부산 여행')
    expect(group.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)

    const created = (await fetchSnapshot()).groups.find((g) => g.id === group.id)!
    expect(created.expenses).toEqual([])
    expect(created.members).toHaveLength(1)
    expect(created.members[0]).toMatchObject({ userId: 'u_test', role: 'owner', name: null })
  })

  it('이름이 비어 있거나 로그인하지 않았으면 만들 수 없다', async () => {
    await expect(createGroup('   ')).rejects.toThrow('그룹 이름')
    await signOut()
    await expect(createGroup('부산')).rejects.toThrow('로그인이 필요해요')
  })
})

describe('resolveInviteCode', () => {
  it('없는 코드는 not-found', async () => {
    expect(await resolveInviteCode('NOPE99')).toEqual({ kind: 'not-found' })
  })

  it('이미 멤버인 그룹은 안내 없이 joined (재입장)', async () => {
    expect(await resolveInviteCode('jeju26')).toEqual({ kind: 'joined', groupId: 'g_jeju', matchedName: null })
  })

  it('공용 코드는 pick — 멤버 목록에서 계정이 있는 사람은 hasAccount, 이름만 있는 사람은 고를 수 있다', async () => {
    const resolution = await resolveInviteCode('TEST42')
    expect(resolution).toEqual({
      kind: 'pick',
      groupId: 'g_test42',
      groupName: '초대코드 테스트방',
      candidates: [
        { id: 'm_owner42', name: '방장데모', hasAccount: true },
        { id: 'm_minji', name: '김민지', hasAccount: false },
      ],
    })
  })

  it('개인 초대 링크(로그인)는 그 자리에 내 계정을 연결하고 알림을 남긴다. 멤버 id는 그대로다', async () => {
    const resolution = await resolveInviteCode('TEST42-m_minji')
    expect(resolution).toEqual({ kind: 'joined', groupId: 'g_test42', matchedName: '김민지' })

    const snapshot = await fetchSnapshot()
    const group = snapshot.groups.find((g) => g.id === 'g_test42')!
    expect(group.members.find((m) => m.id === 'm_minji')).toMatchObject({ userId: 'u_test', name: null })
    expect(snapshot.notifications[0]).toMatchObject({ type: 'member_joined', groupId: 'g_test42', memberId: 'm_minji' })
    expect(snapshot.notifications[0].title).toBe('테스트님이 [초대코드 테스트방] 그룹에 참여했어요')
  })

  it('개인 초대 링크(비로그인)는 그 자리로 세션만 지정하고 알림은 만들지 않는다', async () => {
    await signOut()
    const before = (await fetchSnapshot()).notifications.length
    expect(await resolveInviteCode('TEST42-m_minji')).toEqual({ kind: 'joined', groupId: 'g_test42', matchedName: '김민지' })

    const snapshot = await fetchSnapshot()
    expect(snapshot.session.viewAsMemberId).toBe('m_minji')
    expect(snapshot.groups.map((g) => g.id)).toEqual(['g_test42'])
    expect(snapshot.notifications.length - before).toBe(0)
  })

  it('개인 초대 링크의 자리를 이미 다른 계정이 차지했으면 조용히 pick으로 넘어간다', async () => {
    const resolution = await resolveInviteCode('TEST42-m_owner42')
    expect(resolution.kind).toBe('pick')
  })

  it('한 번 연결된 뒤 다시 들어오면 재입장(joined, 안내 이름 없음)이다', async () => {
    await resolveInviteCode('TEST42-m_minji')
    expect(await resolveInviteCode('TEST42')).toEqual({ kind: 'joined', groupId: 'g_test42', matchedName: null })
  })
})

describe('참여 (07)', () => {
  it('로그인 상태로 대기 멤버를 고르면 그 자리가 내 계정이 된다', async () => {
    await joinAsExistingMember('g_test42', 'm_minji')
    const group = (await fetchSnapshot()).groups.find((g) => g.id === 'g_test42')!
    expect(group.members.find((m) => m.id === 'm_minji')!.userId).toBe('u_test')
  })

  it('이미 가입된 멤버나 없는 멤버는 고를 수 없다', async () => {
    await expect(joinAsExistingMember('g_test42', 'm_owner42')).rejects.toThrow('이미 가입된')
    await expect(joinAsExistingMember('g_test42', 'm_none')).rejects.toThrow('존재하지 않는')
  })

  it('비로그인으로 대기 멤버를 고르면 데이터는 그대로고 세션만 그 자리를 본다 (알림 없음)', async () => {
    await signOut()
    await joinAsExistingMember('g_test42', 'm_minji')
    const snapshot = await fetchSnapshot()
    expect(snapshot.session.viewAsMemberId).toBe('m_minji')
    expect(snapshot.groups[0].members.find((m) => m.id === 'm_minji')).toMatchObject({ userId: null, name: '김민지' })
    expect(snapshot.notifications).toEqual([])
  })

  it('비로그인으로 이름만 입력해 새로 참여하면 계정 없는 멤버가 생기고 알림이 남는다', async () => {
    await signOut()
    const member = await joinAsNewGuest('g_test42', '  이서준 ')
    expect(member).toMatchObject({ userId: null, name: '이서준', role: 'member', groupId: 'g_test42' })

    const snapshot = await fetchSnapshot()
    expect(snapshot.session.viewAsMemberId).toBe(member.id)
    expect(snapshot.notifications[0].title).toBe('이서준님이 [초대코드 테스트방] 그룹에 참여했어요')
  })

  it('이름만으로 참여는 로그인 상태에선 못 하고, 이름이 비면 못 한다', async () => {
    await expect(joinAsNewGuest('g_test42', '이서준')).rejects.toThrow('로그인한 상태')
    await signOut()
    await expect(joinAsNewGuest('g_test42', '  ')).rejects.toThrow('이름을 입력')
  })

  it('로그인 상태로 새 멤버로 참여하면 내 계정 멤버가 추가되고 알림이 남는다', async () => {
    const member = await joinAsNewAccountMember('g_test42')
    expect(member).toMatchObject({ userId: 'u_test', name: null, role: 'member' })
    const snapshot = await fetchSnapshot()
    expect(snapshot.groups.map((g) => g.id).sort()).toEqual(['g_jeju', 'g_test42'])
    expect(snapshot.notifications[0].title).toBe('테스트님이 [초대코드 테스트방] 그룹에 참여했어요')
  })
})

describe('비밀번호 재설정 (14)', () => {
  /** 목업은 메일을 못 보내서 개발 중엔 콘솔에 링크를 찍는다 — 거기서 토큰을 꺼냄 */
  async function requestAndGetToken(email: string): Promise<string | null> {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await requestPasswordReset(email)
    const message = String(info.mock.calls[0]?.[0] ?? '')
    return message.match(/token=([\w-]+)/)?.[1] ?? null
  }

  it('가입 여부와 상관없이 요청은 똑같이 끝나고, 없는 이메일에는 토큰이 만들어지지 않는다', async () => {
    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeUndefined()
    expect(await requestAndGetToken('nobody@example.com')).toBeNull()
  })

  it('링크로 새 비밀번호를 정하면 새 비밀번호로만 로그인된다', async () => {
    const token = await requestAndGetToken('a@naver.com')
    expect(token).not.toBeNull()
    expect(await isPasswordResetTokenValid(token!)).toBe(true)

    await resetPassword(token!, 'brand-new')
    await signOut()
    await expect(signIn('a@naver.com', 'aaaaaaaa')).rejects.toThrow()
    await expect(signIn('a@naver.com', 'brand-new')).resolves.toMatchObject({ id: 'u_test' })
  })

  it('토큰은 1회용이다', async () => {
    const token = (await requestAndGetToken('a@naver.com'))!
    await resetPassword(token, 'first')
    expect(await isPasswordResetTokenValid(token)).toBe(false)
    await expect(resetPassword(token, 'second')).rejects.toThrow('만료되었거나 이미 사용')
  })

  it('30분이 지나면 쓸 수 없다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const token = (await requestAndGetToken('a@naver.com'))!
    vi.setSystemTime(Date.now() + 31 * 60 * 1000)
    expect(await isPasswordResetTokenValid(token)).toBe(false)
    await expect(resetPassword(token, 'late')).rejects.toThrow('만료되었거나 이미 사용')
  })

  it('없는 토큰은 무효다', async () => {
    expect(await isPasswordResetTokenValid('nope')).toBe(false)
  })
})
