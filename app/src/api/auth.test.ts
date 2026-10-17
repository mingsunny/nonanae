import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileIncomplete } from './errors'
import {
  approveJoinRequest,
  cancelJoinRequest,
  checkJoinRequest,
  completeProfile,
  createExpense,
  createGroup,
  deleteAccount,
  fetchSnapshot,
  isEmailTaken,
  isPasswordResetTokenValid,
  joinAsExistingMember,
  joinAsNewAccountMember,
  joinAsNewGuest,
  markGroupCreateCoachSeen,
  rejectJoinRequest,
  requestPasswordReset,
  resetMockData,
  resetPassword,
  resolveInviteCode,
  signIn,
  signOut,
  signUp,
  updateProfile,
} from './index'

const newAccount = { email: 'new@example.com', password: 'pw-1234' }
const newProfile = { name: '신규', bank: '토스뱅크', account: '1000-1' }

/** 방장데모(TEST42 '초대코드 테스트방'의 방장)로 로그인해 그 그룹에 들어온 첫 참여 요청을 승인한다 */
async function approveAsOwner42() {
  await signIn('owner.demo@example.com', 'owner1234')
  const request = (await fetchSnapshot()).joinRequests.find((r) => r.groupId === 'g_test42' && !r.mine)!
  await approveJoinRequest(request.id)
  return request
}

/** 가입 1단계(이메일·비밀번호) + 이름·계좌 등록까지 마친 신규 회원 */
async function signUpAndComplete() {
  await signUp(newAccount)
  return completeProfile(newProfile)
}

beforeEach(async () => {
  await resetMockData()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('시작 상태', () => {
  it('저장된 데이터가 없는 채로 앱을 처음 열면 로그아웃 상태다 (인트로부터 보이게)', async () => {
    vi.resetModules()
    const { clearStoredDb } = await import('./mockDb')
    clearStoredDb()
    const fresh = await import('./index')
    expect((await fresh.fetchSnapshot()).session).toEqual({ userId: null, viewAsMemberId: null })
  })

  it('resetMockData는 기본이 테스트 계정 로그인 상태(테스트 전제), signedIn: false면 로그아웃 상태다', async () => {
    await resetMockData()
    expect((await fetchSnapshot()).session.userId).toBe('u_test')
    await resetMockData({ signedIn: false })
    const snapshot = await fetchSnapshot()
    expect(snapshot.session.userId).toBeNull()
    expect(snapshot.groups).toEqual([])
    // 로그아웃 상태여도 데모 데이터는 그대로라, 테스트 계정으로 로그인하면 데모 그룹이 보인다
    await signIn('a@naver.com', 'aaaaaaaa')
    expect((await fetchSnapshot()).groups.map((g) => g.id)).toEqual(['g_jeju'])
  })
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

describe('signUp / completeProfile / isEmailTaken', () => {
  it('가입 1단계만 마치면 로그인은 됐지만 이름·계좌가 없어 "프로필 미완성"으로 다룬다 (그룹·유저는 비어 있다)', async () => {
    await signUp(newAccount)
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: null, needsProfile: true })
    expect(snapshot.groups).toEqual([])
    expect(snapshot.users).toEqual([])
  })

  it('이름·은행·계좌를 등록하면 정식 회원이 되고, 그룹은 없고, 안내(coach)는 아직 안 본 상태다', async () => {
    const user = await signUpAndComplete()
    expect(user).toMatchObject({ email: 'new@example.com', name: '신규', authProvider: 'email', seenGroupCreateCoach: false })
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: user.id, viewAsMemberId: null })
    expect(snapshot.groups).toEqual([])
    // 그룹이 없어도 내 정보는 읽을 수 있어야 함 (03 인사말, 04 프로필)
    expect(snapshot.users.map((u) => u.id)).toEqual([user.id])
  })

  it('이름·계좌를 등록하기 전에 로그아웃했다가 다시 로그인하면 ProfileIncomplete로 알리고, 로그인 상태는 유지한다', async () => {
    await signUp(newAccount)
    await signOut()
    await expect(signIn('new@example.com', 'pw-1234')).rejects.toBeInstanceOf(ProfileIncomplete)
    expect((await fetchSnapshot()).session.needsProfile).toBe(true)
    await completeProfile(newProfile)
    expect((await fetchSnapshot()).session.needsProfile).toBeUndefined()
  })

  it('등록을 마친 계정으로 다시 로그인할 수 있다', async () => {
    await signUpAndComplete()
    await signOut()
    await expect(signIn('new@example.com', 'pw-1234')).resolves.toMatchObject({ name: '신규' })
  })

  it('이미 가입된 이메일이면 실패하고, isEmailTaken도 true를 돌려준다', async () => {
    expect(await isEmailTaken('A@naver.com')).toBe(true)
    expect(await isEmailTaken('new@example.com')).toBe(false)
    await expect(signUp({ ...newAccount, email: 'a@naver.com' })).rejects.toThrow('이미 가입된 이메일이에요')
  })

  it('가입 1단계를 마친 이메일은 바로 중복으로 잡힌다', async () => {
    await signUp(newAccount)
    expect(await isEmailTaken('new@example.com')).toBe(true)
  })

  it('이름·은행·계좌 중 하나라도 비면 등록에 실패한다', async () => {
    await signUp(newAccount)
    await expect(completeProfile({ ...newProfile, name: '  ' })).rejects.toThrow('모두 입력')
    await expect(completeProfile({ ...newProfile, bank: '' })).rejects.toThrow('모두 입력')
    await expect(completeProfile({ ...newProfile, account: '' })).rejects.toThrow('모두 입력')
    expect((await fetchSnapshot()).session.needsProfile).toBe(true)
  })

  it('로그인하지 않은 상태에서는 등록할 수 없다', async () => {
    await signOut()
    await expect(completeProfile(newProfile)).rejects.toThrow('로그인이 필요해요')
  })
})

describe('signOut / deleteAccount', () => {
  it('로그아웃하면 세션이 비고 내 그룹이 안 보인다', async () => {
    await signOut()
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: null })
    expect(snapshot.groups).toEqual([])
  })

  it('탈퇴하면 그 계정으로 로그인할 수 없다. 그룹의 멤버 자리는 이름이 남은 미가입 멤버가 된다 (schema.md "삭제 시 동작")', async () => {
    await deleteAccount()
    await expect(signIn('a@naver.com', 'aaaaaaaa')).rejects.toThrow()
    const resolution = await resolveInviteCode('JEJU26')
    if (resolution.kind !== 'pick') throw new Error('pick이어야 함')
    expect(resolution.candidates.find((c) => c.id === 'm_me')).toEqual({ id: 'm_me', name: '테스트', hasAccount: false })
  })

  it('탈퇴해도 그 멤버가 결제한 지출과 참여 기록은 그대로 남는다', async () => {
    // 테스트 계정이 TEST42에 일반 멤버로 들어가 지출을 하나 남긴다
    await joinAsNewAccountMember('g_test42')
    await approveAsOwner42()
    await signIn('a@naver.com', 'aaaaaaaa')
    const myMemberId = (await fetchSnapshot()).groups
      .find((g) => g.id === 'g_test42')!
      .members.find((m) => m.userId === 'u_test')!.id
    await createExpense({
      groupId: 'g_test42',
      paidBy: myMemberId,
      title: '저녁',
      amount: 30000,
      category: '식비',
      receiptImageUrl: null,
      splitType: 'equal',
      spentAt: '2026-10-01',
      participants: [{ memberId: myMemberId, shareAmount: null }],
    })

    await deleteAccount()
    // 새 계정으로 그 자리를 다시 고르고 방장이 승인하면 지출 기록이 그대로 이어진다
    await signUpAndComplete()
    await joinAsExistingMember('g_test42', myMemberId)
    await approveAsOwner42()
    const group = (await fetchSnapshot()).groups.find((g) => g.id === 'g_test42')!
    expect(group.members.find((m) => m.id === myMemberId)).toMatchObject({ name: null })
    expect(group.expenses.filter((e) => e.paidBy === myMemberId)).toHaveLength(1)
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
    expect(await resolveInviteCode('jeju26')).toEqual({ kind: 'joined', groupId: 'g_jeju' })
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

  it('개인 초대 링크는 열기만 해서는 요청하지 않고 그룹 이름과 그 자리를 알려준다 (invite)', async () => {
    expect(await resolveInviteCode('TEST42-m_minji')).toEqual({
      kind: 'invite',
      groupId: 'g_test42',
      groupName: '초대코드 테스트방',
      memberId: 'm_minji',
      memberName: '김민지',
    })
    expect((await fetchSnapshot()).joinRequests).toEqual([])
  })

  it('개인 초대 링크(로그인)에서 참여하면 그 자리로 참여 요청을 보낸다. 방장에게 알림이 간다', async () => {
    await resolveInviteCode('TEST42-m_minji')
    await joinAsExistingMember('g_test42', 'm_minji')
    const snapshot = await fetchSnapshot()
    expect(snapshot.groups.map((g) => g.id)).toEqual(['g_jeju']) // 아직 멤버가 아니다
    expect(snapshot.joinRequests).toEqual([
      expect.objectContaining({ groupId: 'g_test42', name: '테스트', memberId: 'm_minji', isGuest: false, mine: true }),
    ])

    const request = await approveAsOwner42()
    expect(request).toMatchObject({ name: '테스트', memberName: '김민지', mine: false })
    const ownerView = await fetchSnapshot()
    expect(ownerView.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'join_request', memberId: null, title: '테스트님이 [초대코드 테스트방] 그룹에 참여를 요청했어요' }),
        expect.objectContaining({ type: 'member_joined', memberId: 'm_minji', title: '테스트님이 [초대코드 테스트방] 그룹에 참여했어요' }),
      ]),
    )
  })

  it('승인되면 그 자리에 내 계정이 연결된다. 멤버 id는 그대로라 기존 기록이 이어진다', async () => {
    await resolveInviteCode('TEST42-m_minji')
    await joinAsExistingMember('g_test42', 'm_minji')
    await approveAsOwner42()
    await signIn('a@naver.com', 'aaaaaaaa')
    expect(await resolveInviteCode('TEST42')).toEqual({ kind: 'joined', groupId: 'g_test42' })
    const group = (await fetchSnapshot()).groups.find((g) => g.id === 'g_test42')!
    expect(group.members.find((m) => m.id === 'm_minji')).toMatchObject({ userId: 'u_test', name: null })
  })

  it('요청을 보낸 뒤 다시 들어오면 새로 요청하지 않고 대기(requested)로 이어진다', async () => {
    await resolveInviteCode('TEST42-m_minji')
    await joinAsExistingMember('g_test42', 'm_minji')
    expect((await resolveInviteCode('TEST42-m_minji')).kind).toBe('requested')
    expect((await resolveInviteCode('TEST42')).kind).toBe('requested')
    expect((await fetchSnapshot()).joinRequests).toHaveLength(1)
  })

  it('개인 초대 링크의 자리를 이미 다른 계정이 차지했으면 조용히 pick으로 넘어간다', async () => {
    const resolution = await resolveInviteCode('TEST42-m_owner42')
    expect(resolution.kind).toBe('pick')
  })
})

describe('참여 요청 (07)', () => {
  it('로그인 상태로 대기 멤버를 고르면 그 자리로 요청하고, 승인되면 그 자리가 내 계정이 된다', async () => {
    await joinAsExistingMember('g_test42', 'm_minji')
    expect(await checkJoinRequest('g_test42')).toBe('pending')
    await approveAsOwner42()
    await signIn('a@naver.com', 'aaaaaaaa')
    expect(await checkJoinRequest('g_test42')).toBe('joined')
    const group = (await fetchSnapshot()).groups.find((g) => g.id === 'g_test42')!
    expect(group.members.find((m) => m.id === 'm_minji')!.userId).toBe('u_test')
  })

  it('이미 가입된 멤버나 없는 멤버는 고를 수 없다', async () => {
    await expect(joinAsExistingMember('g_test42', 'm_owner42')).rejects.toThrow('이미 가입된')
    await expect(joinAsExistingMember('g_test42', 'm_none')).rejects.toThrow('존재하지 않는')
  })

  it('비로그인으로 대기 멤버를 고르면 승인 전엔 그룹이 안 보이고, 승인되면 이 브라우저가 그 자리로 들어간다 (알림 없음)', async () => {
    await signOut()
    await joinAsExistingMember('g_test42', 'm_minji')
    expect((await fetchSnapshot()).groups).toEqual([])

    const request = await approveAsOwner42()
    expect(request).toMatchObject({ name: '김민지', isGuest: true, memberId: 'm_minji' })
    expect((await fetchSnapshot()).notifications.map((n) => n.type)).toEqual(['join_request'])

    await signOut()
    expect(await checkJoinRequest('g_test42')).toBe('joined')
    const snapshot = await fetchSnapshot()
    expect(snapshot.session.viewAsMemberId).toBe('m_minji')
    expect(snapshot.groups[0].members.find((m) => m.id === 'm_minji')).toMatchObject({ userId: null, name: '김민지' })
  })

  it('비로그인으로 이름만 입력해 요청하면, 승인될 때 계정 없는 멤버가 생기고 참여 알림이 남는다', async () => {
    await signOut()
    await joinAsNewGuest('g_test42', '  이서준 ')
    await approveAsOwner42()
    await signOut()
    expect((await resolveInviteCode('TEST42')).kind).toBe('joined')

    const snapshot = await fetchSnapshot()
    const me = snapshot.groups[0].members.find((m) => m.id === snapshot.session.viewAsMemberId)
    expect(me).toMatchObject({ userId: null, name: '이서준', role: 'member' })
    expect(snapshot.notifications.map((n) => n.title)).toContain('이서준님이 [초대코드 테스트방] 그룹에 참여했어요')
  })

  it('이름만으로 참여는 로그인 상태에선 못 하고, 이름이 비면 못 한다', async () => {
    await expect(joinAsNewGuest('g_test42', '이서준')).rejects.toThrow('로그인한 상태')
    await signOut()
    await expect(joinAsNewGuest('g_test42', '  ')).rejects.toThrow('이름을 입력')
  })

  it('로그인 상태로 새 멤버로 요청하면, 승인될 때 내 계정 멤버가 추가되고 알림이 남는다', async () => {
    await joinAsNewAccountMember('g_test42')
    await approveAsOwner42()
    await signIn('a@naver.com', 'aaaaaaaa')
    const snapshot = await fetchSnapshot()
    expect(snapshot.groups.map((g) => g.id).sort()).toEqual(['g_jeju', 'g_test42'])
    expect(snapshot.groups.find((g) => g.id === 'g_test42')!.members.at(-1)).toMatchObject({
      userId: 'u_test',
      name: null,
      role: 'member',
    })
    expect(snapshot.notifications.map((n) => n.title)).toContain('테스트님이 [초대코드 테스트방] 그룹에 참여했어요')
  })

  it('다시 요청하면 이전 요청을 바꾸고, 방장 알림은 처음 한 번만 만든다', async () => {
    await joinAsExistingMember('g_test42', 'm_minji')
    await joinAsNewAccountMember('g_test42')
    const { joinRequests } = await fetchSnapshot()
    expect(joinRequests).toEqual([expect.objectContaining({ memberId: null })])

    await signIn('owner.demo@example.com', 'owner1234')
    const titles = (await fetchSnapshot()).notifications.filter((n) => n.type === 'join_request')
    expect(titles).toHaveLength(1)
  })

  it('방장이 거절하면 요청이 사라지고 요청한 쪽은 none으로 확인된다', async () => {
    await joinAsNewAccountMember('g_test42')
    await signIn('owner.demo@example.com', 'owner1234')
    const request = (await fetchSnapshot()).joinRequests[0]
    await rejectJoinRequest(request.id)
    expect((await fetchSnapshot()).joinRequests).toEqual([])

    await signIn('a@naver.com', 'aaaaaaaa')
    expect(await checkJoinRequest('g_test42')).toBe('none')
    expect((await fetchSnapshot()).groups.map((g) => g.id)).toEqual(['g_jeju'])
  })

  it('요청한 사람은 요청을 취소할 수 있다', async () => {
    await joinAsNewAccountMember('g_test42')
    await cancelJoinRequest('g_test42')
    expect(await checkJoinRequest('g_test42')).toBe('none')
    expect((await fetchSnapshot()).joinRequests).toEqual([])
  })

  it('방장이 아니면 승인·거절할 수 없다', async () => {
    await signOut()
    await joinAsNewGuest('g_test42', '이서준')
    await signIn('a@naver.com', 'aaaaaaaa') // 테스트 계정은 TEST42의 방장이 아니라 요청이 보이지도 않는다
    expect((await fetchSnapshot()).joinRequests).toEqual([])

    await signIn('owner.demo@example.com', 'owner1234')
    const request = (await fetchSnapshot()).joinRequests[0]
    await signIn('a@naver.com', 'aaaaaaaa')
    await expect(approveJoinRequest(request.id)).rejects.toThrow('방장만')
    await expect(rejectJoinRequest(request.id)).rejects.toThrow('방장만')
  })

  it('요청한 자리를 그 사이 다른 사람이 차지했으면 승인할 수 없다고 알린다', async () => {
    await signOut()
    await joinAsExistingMember('g_test42', 'm_minji') // 게스트 요청
    await signIn('a@naver.com', 'aaaaaaaa')
    await joinAsExistingMember('g_test42', 'm_minji') // 회원 요청
    await signIn('owner.demo@example.com', 'owner1234')
    const [guestRequest, memberRequest] = (await fetchSnapshot()).joinRequests
    await approveJoinRequest(memberRequest.id)
    await expect(approveJoinRequest(guestRequest.id)).rejects.toThrow('이미 다른 사람이 차지했어요')
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
