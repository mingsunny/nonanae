// @vitest-environment jsdom
import type { AuthError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 진짜 Supabase에는 연결하지 않고, 클라이언트를 가짜로 바꿔 "우리 코드가 무엇을 보내고 결과를 어떻게 해석하는지"만 검증한다.
const mocks = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signInAnonymously: vi.fn(),
    getSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
  recovery: { opened: false },
}))

vi.mock('../lib/supabase', () => ({
  USE_SUPABASE: true,
  getSupabase: () => ({ auth: mocks.auth, from: mocks.from, rpc: mocks.rpc }),
  // 재설정 메일 링크로 열린 페이지인지 (테스트마다 mocks.recovery.opened로 바꾼다)
  get openedFromRecoveryLink() {
    return mocks.recovery.opened
  },
}))

import {
  addPendingMember,
  authErrorMessage,
  createExpense,
  createGroup,
  deleteAccount,
  deleteExpense,
  fetchSnapshot,
  joinAsExistingMember,
  joinAsNewAccountMember,
  joinAsNewGuest,
  markGroupCreateCoachSeen,
  isPasswordResetTokenValid,
  markNotificationRead,
  requestPasswordReset,
  resetPassword,
  resolveInviteCode,
  signIn,
  signOut,
  signUp,
  updateExpense,
  updateProfile,
} from './supabaseApi'

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

type Fixture = { data: unknown; error: unknown }

type Builder = Record<string, ReturnType<typeof vi.fn>>

/** from(테이블).select().eq()... 어느 순서로 이어 불러도 같은 결과를 돌려주는 가짜 조회·쓰기 */
function fakeTable(result: Fixture): Builder {
  const builder: Builder = {}
  for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'or', 'not', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(async () => result)
  builder.maybeSingle = vi.fn(async () => result)
  // await로 기다릴 수 있게(PostgREST 조회처럼)
  builder.then = vi.fn((resolve: (v: Fixture) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject),
  )
  return builder
}

/**
 * 테이블 이름별로 돌려줄 결과를 정한다. 안 정한 테이블은 빈 목록.
 * 같은 테이블을 여러 번 부르면 배열로 준 결과를 순서대로 쓴다(마지막 것은 계속 반복).
 * 돌려주는 값으로 "어느 테이블에 어떤 호출이 갔는지" 확인할 수 있다: made.expenses[0].insert.mock.calls
 */
function mockTables(fixtures: Record<string, Fixture | Fixture[]>): Record<string, Builder[]> {
  const made: Record<string, Builder[]> = {}
  mocks.from.mockImplementation((table: string) => {
    const spec = fixtures[table] ?? { data: [], error: null }
    const list = made[table] ?? (made[table] = [])
    const result = Array.isArray(spec) ? spec[Math.min(list.length, spec.length - 1)] : spec
    const builder = fakeTable(result)
    list.push(builder)
    return builder
  })
  return made
}

const ok = (data: unknown): Fixture => ({ data, error: null })

/** DB 함수(RPC)별 결과 */
function mockRpc(handlers: Record<string, (args: Record<string, unknown>) => Fixture>) {
  mocks.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const handler = handlers[fn]
    if (!handler) throw new Error(`unexpected rpc ${fn}`)
    return handler(args)
  })
}

const guestSession = { data: { session: { user: { id: 'anon-1', is_anonymous: true } } } }

beforeEach(() => {
  vi.resetAllMocks()
})

beforeEach(() => {
  localStorage.clear()
  mocks.recovery.opened = false
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

const groupRow = (id: string, name = '제주도 여행') => ({ id, name, invite_code: 'JEJU26' })
const memberRow = (over: Record<string, unknown>) => ({
  id: 'm-1',
  group_id: 'g-1',
  user_id: null,
  guest_uid: null,
  role: 'member',
  name: null,
  joined_at: '2026-09-21T01:00:00Z',
  ...over,
})

describe('fetchSnapshot', () => {
  it('로그인하지 않았으면 세션이 비어 있다', async () => {
    mocks.auth.getSession.mockResolvedValue(noSession)
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: null })
    expect(snapshot.users).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('로그인했으면 내 그룹·멤버·알림과 프로필을 앱 타입으로 담는다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockTables({
      groups: ok([groupRow('g-1')]),
      members: ok([
        memberRow({ id: 'm-owner', user_id: 'user-1', role: 'owner' }),
        memberRow({ id: 'm-pending', name: '김민지' }),
      ]),
      notifications: ok([
        { id: 'n-1', group_id: 'g-1', member_id: 'm-pending', type: 'member_joined', title: '참여', created_at: '2026-09-21T02:00:00Z', read: false },
      ]),
      profiles: ok([profileRow]),
    })

    const snapshot = await fetchSnapshot()

    expect(snapshot.session).toEqual({ userId: 'user-1', viewAsMemberId: null })
    expect(snapshot.users).toEqual([expect.objectContaining({ id: 'user-1', name: '민선', email: 'me@example.com' })])
    expect(snapshot.groups).toHaveLength(1)
    expect(snapshot.groups[0]).toMatchObject({ id: 'g-1', name: '제주도 여행', inviteCode: 'JEJU26' })
    expect(snapshot.groups[0].members).toEqual([
      { id: 'm-owner', userId: 'user-1', groupId: 'g-1', role: 'owner', name: null, joinedAt: '2026-09-21T01:00:00Z' },
      { id: 'm-pending', userId: null, groupId: 'g-1', role: 'member', name: '김민지', joinedAt: '2026-09-21T01:00:00Z' },
    ])
    expect(snapshot.notifications).toEqual([
      expect.objectContaining({ id: 'n-1', groupId: 'g-1', memberId: 'm-pending', type: 'member_joined', read: false }),
    ])
  })

  it('지출과 그 참여자를 묶어서 돌려준다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockTables({
      groups: ok([groupRow('g-1')]),
      members: ok([memberRow({ id: 'm-owner', user_id: 'user-1', role: 'owner' })]),
      expenses: ok([
        { id: 'e-1', group_id: 'g-1', paid_by: 'm-owner', title: '점심', amount: 30000, category: '식비', receipt_image_url: null, split_type: 'equal', spent_at: '2026-09-21', created_at: '2026-09-21T03:00:00Z' },
      ]),
      expense_participants: ok([{ expense_id: 'e-1', member_id: 'm-owner', share_amount: null }]),
      profiles: ok([profileRow]),
    })

    const [group] = (await fetchSnapshot()).groups
    expect(group.expenses).toEqual([
      expect.objectContaining({
        id: 'e-1',
        groupId: 'g-1',
        paidBy: 'm-owner',
        amount: 30000,
        category: '식비',
        spentAt: '2026-09-21',
        participants: [{ expenseId: 'e-1', memberId: 'm-owner', shareAmount: null }],
      }),
    ])
  })

  it('다른 회원의 프로필은 이름·계좌만 채우고 이메일은 비운다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockTables({
      groups: ok([groupRow('g-1')]),
      members: ok([
        memberRow({ id: 'm-owner', user_id: 'user-1', role: 'owner' }),
        memberRow({ id: 'm-friend', user_id: 'user-2' }),
      ]),
      profiles: ok([profileRow, { ...profileRow, id: 'user-2', name: '친구' }]),
    })

    const { users } = await fetchSnapshot()
    expect(users.find((u) => u.id === 'user-2')).toMatchObject({ name: '친구', email: '', emailVerified: false })
  })

  it('게스트(익명) 세션은 정식 회원이 아니고, 자기 자리의 그룹 하나만 본다', async () => {
    mocks.auth.getSession.mockResolvedValue(guestSession)
    mockTables({
      groups: ok([groupRow('g-1', '그룹1'), groupRow('g-2', '그룹2')]),
      members: ok([
        memberRow({ id: 'm-a', group_id: 'g-1', guest_uid: 'anon-1', name: '게스트', joined_at: '2026-09-21T01:00:00Z' }),
        memberRow({ id: 'm-b', group_id: 'g-2', guest_uid: 'anon-1', name: '게스트', joined_at: '2026-09-21T05:00:00Z' }),
        memberRow({ id: 'm-other', group_id: 'g-2', name: '다른사람' }),
      ]),
    })

    const snapshot = await fetchSnapshot()

    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: 'm-b' }) // 가장 최근 자리
    expect(snapshot.groups.map((g) => g.id)).toEqual(['g-2'])
    expect(snapshot.groups[0].members.map((m) => m.id)).toEqual(['m-b', 'm-other'])
    expect(snapshot.users).toEqual([])
  })

  it('게스트가 마지막으로 고른 자리를 기억해 두었다면 그 그룹을 보여준다', async () => {
    localStorage.setItem('nonanae:guest-member', 'm-a')
    mocks.auth.getSession.mockResolvedValue(guestSession)
    mockTables({
      groups: ok([groupRow('g-1', '그룹1'), groupRow('g-2', '그룹2')]),
      members: ok([
        memberRow({ id: 'm-a', group_id: 'g-1', guest_uid: 'anon-1', name: '게스트', joined_at: '2026-09-21T01:00:00Z' }),
        memberRow({ id: 'm-b', group_id: 'g-2', guest_uid: 'anon-1', name: '게스트', joined_at: '2026-09-21T05:00:00Z' }),
      ]),
    })

    const snapshot = await fetchSnapshot()
    expect(snapshot.session.viewAsMemberId).toBe('m-a')
    expect(snapshot.groups.map((g) => g.id)).toEqual(['g-1'])
  })

  it('게스트 세션만 있고 아직 참여한 자리가 없으면 그룹이 비어 있다', async () => {
    mocks.auth.getSession.mockResolvedValue(guestSession)
    mockTables({ groups: ok([]), members: ok([]) })
    const snapshot = await fetchSnapshot()
    expect(snapshot.session).toEqual({ userId: null, viewAsMemberId: null })
    expect(snapshot.groups).toEqual([])
  })

  it('세션은 있는데 프로필이 없으면 로그아웃 상태로 본다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockTables({ profiles: ok([]) })
    expect((await fetchSnapshot()).session.userId).toBeNull()
  })

  it('조회에 실패하면 어느 데이터인지 알려주며 던진다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockTables({ groups: { data: null, error: { message: 'boom' } } })
    await expect(fetchSnapshot()).rejects.toThrow('그룹을(를) 불러오지 못했어요: boom')
  })
})

describe('createGroup', () => {
  it('DB 함수로 그룹을 만들고 초대코드까지 읽어서 돌려준다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ create_group: () => ok('g-new') })
    mockTables({ groups: ok({ id: 'g-new', name: '새 그룹', invite_code: 'ABC234' }) })

    const group = await createGroup('  새 그룹 ')

    expect(mocks.rpc).toHaveBeenCalledWith('create_group', { p_name: '새 그룹' })
    expect(group).toEqual({ id: 'g-new', name: '새 그룹', inviteCode: 'ABC234' })
  })

  it('이름이 비어 있거나 게스트면 서버를 부르기 전에 막는다', async () => {
    await expect(createGroup('   ')).rejects.toThrow('그룹 이름을 입력해주세요')
    mocks.auth.getSession.mockResolvedValue(guestSession)
    await expect(createGroup('그룹')).rejects.toThrow('로그인이 필요해요')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('서버가 거부하면 한국어 문구로 바꿔서 던진다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ create_group: () => ({ data: null, error: { message: 'guests cannot create groups' } }) })
    await expect(createGroup('그룹')).rejects.toThrow('로그인한 회원만 그룹을 만들 수 있어요')
  })
})

describe('resolveInviteCode', () => {
  const memberUuid = '11111111-1111-1111-1111-111111111111'
  const lookupResult = {
    id: 'g-join',
    name: '제주도 여행',
    members: [
      { id: memberUuid, name: '김민지', claimed: false },
      { id: '22222222-2222-2222-2222-222222222222', name: '박서연', claimed: true },
    ],
  }

  it('로그인도 게스트 세션도 없으면 익명 로그인을 만들고 코드를 조회한다', async () => {
    mocks.auth.getSession.mockResolvedValue(noSession)
    mocks.auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'anon-1', is_anonymous: true } }, error: null })
    mockRpc({ lookup_group_by_code: () => ok(null) })

    expect(await resolveInviteCode('nope99')).toEqual({ kind: 'not-found' })

    expect(mocks.auth.signInAnonymously).toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('lookup_group_by_code', { p_code: 'NOPE99' })
  })

  it('이미 세션이 있으면 익명 로그인을 새로 만들지 않는다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ lookup_group_by_code: () => ok(null) })
    await resolveInviteCode('NOPE99')
    expect(mocks.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('공용 코드면 "나 고르기" 목록을 돌려준다 (이미 가입된 자리는 hasAccount)', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ lookup_group_by_code: () => ok(lookupResult) })
    mockTables({ members: ok([]) })

    expect(await resolveInviteCode('jeju26')).toEqual({
      kind: 'pick',
      groupId: 'g-join',
      groupName: '제주도 여행',
      candidates: [
        { id: memberUuid, name: '김민지', hasAccount: false },
        { id: '22222222-2222-2222-2222-222222222222', name: '박서연', hasAccount: true },
      ],
    })
    expect(mocks.rpc).not.toHaveBeenCalledWith('join_group', expect.anything())
  })

  it('이미 이 그룹의 멤버면 참여 처리 없이 바로 들어간다 (게스트면 그 자리를 기억)', async () => {
    mocks.auth.getSession.mockResolvedValue(guestSession)
    mockRpc({ lookup_group_by_code: () => ok(lookupResult) })
    mockTables({ members: ok([{ id: 'm-mine' }]) })

    expect(await resolveInviteCode('JEJU26')).toEqual({ kind: 'joined', groupId: 'g-join', matchedName: null })
    expect(localStorage.getItem('nonanae:guest-member')).toBe('m-mine')
    expect(mocks.rpc).not.toHaveBeenCalledWith('join_group', expect.anything())
  })

  it('개인 초대 링크로 비어 있는 자리를 가리키면 바로 그 자리에 연결한다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ lookup_group_by_code: () => ok(lookupResult), join_group: () => ok(memberUuid) })
    mockTables({ members: ok([]) })

    expect(await resolveInviteCode(`JEJU26-${memberUuid}`)).toEqual({
      kind: 'joined',
      groupId: 'g-join',
      matchedName: '김민지',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('join_group', { p_code: 'JEJU26', p_member_id: memberUuid, p_name: null })
  })

  it('개인 초대 링크의 자리를 이미 다른 사람이 차지했으면 공용 코드처럼 07로 넘긴다', async () => {
    const claimed = '22222222-2222-2222-2222-222222222222'
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ lookup_group_by_code: () => ok(lookupResult) })
    mockTables({ members: ok([]) })

    expect((await resolveInviteCode(`JEJU26-${claimed}`)).kind).toBe('pick')
    expect(mocks.rpc).not.toHaveBeenCalledWith('join_group', expect.anything())
  })

  it('개인 초대 링크의 멤버 id가 uuid 모양이 아니면 공용 코드로 취급한다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mockRpc({ lookup_group_by_code: () => ok(lookupResult) })
    mockTables({ members: ok([]) })
    expect((await resolveInviteCode('JEJU26-m_minji')).kind).toBe('pick')
  })
})

describe('참여 (07)', () => {
  const groupId = 'g-join'
  const lookup = { id: groupId, name: '제주도 여행', members: [{ id: 'm-target', name: '김민지', claimed: false }] }

  /** 06에서 코드를 확인해 둔 상태를 만든다 (07의 참여 함수들은 그때 기억한 코드를 쓴다) */
  async function afterLookup(session: unknown) {
    mocks.auth.getSession.mockResolvedValue(session)
    mockRpc({
      lookup_group_by_code: () => ok(lookup),
      join_group: (args) => ok(args.p_member_id ?? 'm-new'),
    })
    mockTables({ members: ok([]) })
    await resolveInviteCode('JEJU26')
    mocks.rpc.mockClear()
  }

  it('게스트가 이름만으로 새로 참여한다', async () => {
    await afterLookup(guestSession)

    const member = await joinAsNewGuest(groupId, ' 새게스트 ')

    expect(mocks.rpc).toHaveBeenCalledWith('join_group', { p_code: 'JEJU26', p_member_id: null, p_name: '새게스트' })
    expect(member).toMatchObject({ id: 'm-new', userId: null, groupId, role: 'member', name: '새게스트' })
    expect(localStorage.getItem('nonanae:guest-member')).toBe('m-new')
  })

  it('로그인한 상태에서는 이름만으로 참여할 수 없다', async () => {
    await afterLookup(signedInSession)
    await expect(joinAsNewGuest(groupId, '이름')).rejects.toThrow('로그인한 상태에서는 이름만으로 참여할 수 없어요')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('이름이 비어 있으면 서버를 부르지 않는다', async () => {
    await afterLookup(guestSession)
    await expect(joinAsNewGuest(groupId, '   ')).rejects.toThrow('이름을 입력해주세요')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('목록에서 기존 자리를 고른다 (게스트면 그 자리를 기억)', async () => {
    await afterLookup(guestSession)
    await joinAsExistingMember(groupId, 'm-target')
    expect(mocks.rpc).toHaveBeenCalledWith('join_group', { p_code: 'JEJU26', p_member_id: 'm-target', p_name: null })
    expect(localStorage.getItem('nonanae:guest-member')).toBe('m-target')
  })

  it('이미 가입된 자리를 고르면 서버 에러를 한국어로 바꿔서 던진다', async () => {
    await afterLookup(signedInSession)
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'member not available' } })
    await expect(joinAsExistingMember(groupId, 'm-target')).rejects.toThrow('이미 가입된 멤버예요')
  })

  it('로그인한 회원이 목록에 없는 새 멤버로 참여한다', async () => {
    await afterLookup(signedInSession)
    const member = await joinAsNewAccountMember(groupId)
    expect(mocks.rpc).toHaveBeenCalledWith('join_group', { p_code: 'JEJU26', p_member_id: null, p_name: null })
    expect(member).toMatchObject({ id: 'm-new', userId: 'user-1', groupId, role: 'member', name: null })
  })

  it('06을 거치지 않아 코드를 모르는 그룹이면 코드를 다시 입력하라고 안내한다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    await expect(joinAsNewAccountMember('g-unknown')).rejects.toThrow('초대코드를 다시 입력해주세요')
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

  it('로그아웃한다 (게스트가 기억해 둔 자리도 지운다)', async () => {
    localStorage.setItem('nonanae:guest-member', 'm-a')
    mocks.auth.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mocks.auth.signOut).toHaveBeenCalled()
    expect(localStorage.getItem('nonanae:guest-member')).toBeNull()
  })
})

describe('지출 (08~11)', () => {
  const groupId = 'g-1'
  const input = {
    groupId,
    paidBy: 'm-a',
    title: ' 점심 ',
    amount: 30000,
    category: '식비' as const,
    receiptImageUrl: null,
    splitType: 'equal' as const,
    spentAt: '2026-09-21',
    participants: [
      { memberId: 'm-a', shareAmount: null },
      { memberId: 'm-b', shareAmount: null },
    ],
  }
  const members = ok([{ id: 'm-a' }, { id: 'm-b' }, { id: 'm-c' }])
  const expenseRow = {
    id: 'e-1',
    group_id: groupId,
    paid_by: 'm-a',
    title: '점심',
    amount: 30000,
    category: '식비',
    receipt_image_url: null,
    split_type: 'equal',
    spent_at: '2026-09-21',
    created_at: '2026-09-21T03:00:00Z',
  }

  describe('createExpense', () => {
    it('지출과 참여자를 저장하고, 결제자 이름으로 알림을 남긴다', async () => {
      const made = mockTables({
        members: [members, ok({ name: null, profiles: { name: '민선' } })],
        expenses: ok(expenseRow),
        groups: ok({ name: '제주도 여행' }),
      })

      const expense = await createExpense(input)

      expect(made.expenses[0].insert.mock.calls[0][0]).toEqual({
        group_id: groupId,
        paid_by: 'm-a',
        title: '점심',
        amount: 30000,
        category: '식비',
        receipt_image_url: null,
        split_type: 'equal',
        spent_at: '2026-09-21',
      })
      expect(made.expense_participants[0].insert.mock.calls[0][0]).toEqual([
        { expense_id: 'e-1', member_id: 'm-a', group_id: groupId, share_amount: null },
        { expense_id: 'e-1', member_id: 'm-b', group_id: groupId, share_amount: null },
      ])
      expect(made.notifications[0].insert.mock.calls[0][0]).toEqual({
        group_id: groupId,
        member_id: 'm-a',
        type: 'expense',
        title: '[제주도 여행]에 민선님이 결제한 내역이 추가됐어요',
      })
      expect(expense).toMatchObject({ id: 'e-1', groupId, paidBy: 'm-a', amount: 30000, category: '식비' })
      expect(expense.participants).toHaveLength(2)
    })

    it('결제자가 이름만 있는 멤버(게스트·대기 중)면 그 이름을 알림에 쓴다', async () => {
      const made = mockTables({
        members: [members, ok({ name: '김민지', profiles: null })],
        expenses: ok(expenseRow),
        groups: ok({ name: '제주도 여행' }),
      })
      await createExpense(input)
      expect(made.notifications[0].insert.mock.calls[0][0].title).toBe('[제주도 여행]에 김민지님이 결제한 내역이 추가됐어요')
    })

    it('참여자를 저장하지 못하면 지출도 되돌리고 에러를 던진다', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const made = mockTables({
        members,
        expenses: [ok(expenseRow), ok(null)],
        expense_participants: { data: null, error: { code: '23503', message: 'fk' } },
      })

      await expect(createExpense(input)).rejects.toThrow('그룹 멤버가 아닌 사람이 포함돼 있어요')

      expect(made.expenses[1].delete).toHaveBeenCalled()
      expect(made.expenses[1].eq).toHaveBeenCalledWith('id', 'e-1')
      expect(made.notifications).toBeUndefined() // 알림도 만들지 않는다
    })

    it('알림을 못 만들어도 지출 등록은 성공한다', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockTables({
        members: [members, { data: null, error: { message: 'boom' } }],
        expenses: ok(expenseRow),
        groups: ok({ name: '제주도 여행' }),
      })
      await expect(createExpense(input)).resolves.toMatchObject({ id: 'e-1' })
      expect(spy).toHaveBeenCalled()
    })

    it('잘못된 입력은 서버에 쓰기 전에 막는다', async () => {
      await expect(createExpense({ ...input, amount: 0 })).rejects.toThrow('금액은 0보다 큰 정수여야 해요')
      await expect(createExpense({ ...input, amount: 1000.5 })).rejects.toThrow('금액은 0보다 큰 정수여야 해요')
      await expect(createExpense({ ...input, title: '  ' })).rejects.toThrow('항목명을 입력해주세요')
      await expect(createExpense({ ...input, participants: [] })).rejects.toThrow('참여자는 최소 1명이어야 해요')
      await expect(
        createExpense({ ...input, participants: [input.participants[0], input.participants[0]] }),
      ).rejects.toThrow('같은 참여자가 두 번 들어갈 수 없어요')
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('그룹 멤버가 아닌 사람이 결제자·참여자에 있으면 막는다', async () => {
      const made = mockTables({ members })
      await expect(createExpense({ ...input, paidBy: 'm-outsider' })).rejects.toThrow('그룹 멤버가 아닌 사람이 포함돼 있어요')
      await expect(
        createExpense({ ...input, participants: [{ memberId: 'm-outsider', shareAmount: null }] }),
      ).rejects.toThrow('그룹 멤버가 아닌 사람이 포함돼 있어요')
      expect(made.expenses).toBeUndefined() // 지출은 만들지도 않았다
    })

    it('내 그룹이 아니면(멤버가 하나도 안 보이면) 없는 그룹으로 본다', async () => {
      mockTables({ members: ok([]) })
      await expect(createExpense(input)).rejects.toThrow('존재하지 않는 그룹이에요')
    })
  })

  describe('updateExpense', () => {
    it('지출 본문을 고치고, 참여자는 upsert 후 빠진 사람만 지운다 (그룹은 바꾸지 않는다)', async () => {
      const made = mockTables({
        expenses: [ok({ id: 'e-1', group_id: groupId }), ok(expenseRow)],
        members,
      })

      const expense = await updateExpense('e-1', input)

      const update = made.expenses[1].update.mock.calls[0][0]
      expect(update).toMatchObject({ title: '점심', amount: 30000, paid_by: 'm-a' })
      expect(update).not.toHaveProperty('group_id')
      expect(made.expense_participants[0].upsert.mock.calls[0]).toEqual([
        [
          { expense_id: 'e-1', member_id: 'm-a', group_id: groupId, share_amount: null },
          { expense_id: 'e-1', member_id: 'm-b', group_id: groupId, share_amount: null },
        ],
        { onConflict: 'expense_id,member_id' },
      ])
      expect(made.expense_participants[1].delete).toHaveBeenCalled()
      expect(made.expense_participants[1].eq).toHaveBeenCalledWith('expense_id', 'e-1')
      expect(made.expense_participants[1].not).toHaveBeenCalledWith('member_id', 'in', '(m-a,m-b)')
      expect(made.notifications).toBeUndefined() // 수정은 알림을 만들지 않는다
      expect(expense.participants).toHaveLength(2)
    })

    it('없는 지출이면 던진다', async () => {
      mockTables({ expenses: ok(null) })
      await expect(updateExpense('e-missing', input)).rejects.toThrow('존재하지 않는 지출이에요')
    })

    it('다른 그룹으로 옮기려 하면 막는다', async () => {
      mockTables({ expenses: ok({ id: 'e-1', group_id: 'g-other' }) })
      await expect(updateExpense('e-1', input)).rejects.toThrow('지출의 그룹은 바꿀 수 없어요')
    })

    it('참여자에 문제가 있으면 아무것도 고치기 전에 막는다', async () => {
      const made = mockTables({ expenses: ok({ id: 'e-1', group_id: groupId }), members })
      await expect(
        updateExpense('e-1', { ...input, participants: [{ memberId: 'm-outsider', shareAmount: null }] }),
      ).rejects.toThrow('그룹 멤버가 아닌 사람이 포함돼 있어요')
      expect(made.expenses).toHaveLength(1) // 존재 확인 조회뿐, update는 없었다
      expect(made.expense_participants).toBeUndefined()
    })
  })

  describe('deleteExpense', () => {
    it('지출을 지운다', async () => {
      const made = mockTables({ expenses: ok([{ id: 'e-1' }]) })
      await deleteExpense('e-1')
      expect(made.expenses[0].delete).toHaveBeenCalled()
      expect(made.expenses[0].eq).toHaveBeenCalledWith('id', 'e-1')
    })

    it('지워진 행이 없으면(없거나 내 그룹이 아니면) 없는 지출로 본다', async () => {
      mockTables({ expenses: ok([]) })
      await expect(deleteExpense('e-x')).rejects.toThrow('존재하지 않는 지출이에요')
    })
  })
})

describe('멤버 추가·알림 읽음', () => {
  it('앱 미가입 친구를 이름만으로 추가한다', async () => {
    const made = mockTables({
      members: ok({ id: 'm-new', group_id: 'g-1', user_id: null, guest_uid: null, role: 'member', name: '박서연', joined_at: '2026-09-21T04:00:00Z' }),
    })

    const member = await addPendingMember('g-1', ' 박서연 ')

    expect(made.members[0].insert.mock.calls[0][0]).toEqual({ group_id: 'g-1', name: '박서연' })
    expect(member).toEqual({ id: 'm-new', userId: null, groupId: 'g-1', role: 'member', name: '박서연', joinedAt: '2026-09-21T04:00:00Z' })
  })

  it('이름이 비어 있으면 서버를 부르지 않는다', async () => {
    await expect(addPendingMember('g-1', '  ')).rejects.toThrow('이름을 입력해주세요')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('없는 그룹이면 그렇게 알려주고, 내 그룹이 아니면 권한이 없다고 알려준다', async () => {
    mockTables({ members: { data: null, error: { code: '23503', message: 'fk' } } })
    await expect(addPendingMember('g-x', '이름')).rejects.toThrow('존재하지 않는 그룹이에요')
    mockTables({ members: { data: null, error: { code: '42501', message: 'rls' } } })
    await expect(addPendingMember('g-x', '이름')).rejects.toThrow('이 작업을 할 권한이 없어요')
  })

  it('알림을 읽음으로 표시한다', async () => {
    const made = mockTables({ notifications: { data: null, error: null } })
    await markNotificationRead('n-1')
    expect(made.notifications[0].update).toHaveBeenCalledWith({ read: true })
    expect(made.notifications[0].eq).toHaveBeenCalledWith('id', 'n-1')
  })
})

describe('회원 탈퇴 (04)', () => {
  it('DB 함수로 계정을 지우고, 이 기기의 로그인 정보와 게스트 기억을 정리한다', async () => {
    localStorage.setItem('nonanae:guest-member', 'm-a')
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    mocks.auth.signOut.mockResolvedValue({ error: null })

    await deleteAccount()

    expect(mocks.rpc).toHaveBeenCalledWith('delete_my_account')
    // 서버에서 계정이 사라졌으니 로그아웃 요청 없이 이 기기 로그인 정보만 지운다
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(localStorage.getItem('nonanae:guest-member')).toBeNull()
  })

  it('로그인하지 않았거나 게스트면 서버를 부르지 않는다', async () => {
    mocks.auth.getSession.mockResolvedValue(guestSession)
    await expect(deleteAccount()).rejects.toThrow('로그인이 필요해요')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('서버가 거부하면 로그인 정보를 지우지 않고 에러를 던진다', async () => {
    mocks.auth.getSession.mockResolvedValue(signedInSession)
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'guests cannot delete accounts' } })
    await expect(deleteAccount()).rejects.toThrow('로그인한 회원만 탈퇴할 수 있어요')
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
  })
})

describe('비밀번호 재설정 (14)', () => {
  describe('requestPasswordReset', () => {
    it('메일 링크가 돌아올 주소(이 앱의 /password-reset)를 넘긴다', async () => {
      mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
      await requestPasswordReset(' me@example.com ')
      expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', {
        redirectTo: `${window.location.origin}/password-reset`,
      })
    })

    it('서버 에러는 삼킨다 — 가입 여부에 따라 결과가 달라 보이면 계정 존재 여부가 노출된다', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: authError('unexpected_failure') })
      await expect(requestPasswordReset('me@example.com')).resolves.toBeUndefined()
      expect(spy).toHaveBeenCalled()
    })

    it('요청이 너무 잦다는 안내만은 보여준다 (계정 존재 여부와 무관)', async () => {
      mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: authError('over_email_send_rate_limit') })
      await expect(requestPasswordReset('me@example.com')).rejects.toThrow('요청이 너무 많아요')
    })
  })

  describe('isPasswordResetTokenValid', () => {
    it('재설정 링크로 열렸고 링크가 세션으로 바뀌었으면 유효하다', async () => {
      mocks.recovery.opened = true
      mocks.auth.getSession.mockResolvedValue(signedInSession)
      expect(await isPasswordResetTokenValid()).toBe(true)
    })

    it('링크로 열렸지만 세션이 없으면(만료·이미 사용) 유효하지 않다', async () => {
      mocks.recovery.opened = true
      mocks.auth.getSession.mockResolvedValue(noSession)
      expect(await isPasswordResetTokenValid()).toBe(false)
    })

    it('링크로 열리지 않았다면, 이미 로그인한 사람이라도 유효하지 않다', async () => {
      mocks.recovery.opened = false
      mocks.auth.getSession.mockResolvedValue(signedInSession)
      expect(await isPasswordResetTokenValid()).toBe(false)
      expect(mocks.auth.getSession).not.toHaveBeenCalled()
    })

    it('게스트(익명) 세션은 유효하지 않다', async () => {
      mocks.recovery.opened = true
      mocks.auth.getSession.mockResolvedValue(guestSession)
      expect(await isPasswordResetTokenValid()).toBe(false)
    })
  })

  describe('resetPassword', () => {
    it('새 비밀번호를 저장하고, 재설정용 세션을 정리한다', async () => {
      mocks.recovery.opened = true
      mocks.auth.getSession.mockResolvedValue(signedInSession)
      mocks.auth.updateUser.mockResolvedValue({ error: null })
      mocks.auth.signOut.mockResolvedValue({ error: null })

      await resetPassword('new-password-1')

      expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password-1' })
      expect(mocks.auth.signOut).toHaveBeenCalled()
    })

    it('링크가 만료됐으면 비밀번호를 바꾸지 않는다', async () => {
      mocks.recovery.opened = true
      mocks.auth.getSession.mockResolvedValue(noSession)
      await expect(resetPassword('new-password-1')).rejects.toThrow('링크가 만료되었거나 이미 사용됐어요')
      expect(mocks.auth.updateUser).not.toHaveBeenCalled()
    })

    it('비어 있으면 서버를 부르지 않는다', async () => {
      await expect(resetPassword('')).rejects.toThrow('새 비밀번호를 입력해주세요')
      expect(mocks.auth.getSession).not.toHaveBeenCalled()
    })

    it('이전과 같은 비밀번호면 한국어로 안내하고 로그아웃하지 않는다', async () => {
      mocks.recovery.opened = true
      mocks.auth.getSession.mockResolvedValue(signedInSession)
      mocks.auth.updateUser.mockResolvedValue({ error: authError('same_password') })
      await expect(resetPassword('same')).rejects.toThrow('이전과 다른 비밀번호를 입력해주세요.')
      expect(mocks.auth.signOut).not.toHaveBeenCalled()
    })
  })
})
