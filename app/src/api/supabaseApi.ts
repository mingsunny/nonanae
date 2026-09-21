// Supabase 연동 (1단계: 로그인·가입·프로필 / 2단계: 그룹 생성·초대코드 참여). api/index.ts가 VITE_USE_SUPABASE=true일 때만 여기로 넘겨준다.
// 로그인은 Supabase Auth, 이름·계좌 같은 프로필은 public.profiles 테이블이 맡는다 (docs/spec/schema.md "DB 구현").
// 게스트는 Supabase 익명 로그인 세션으로 표현한다 — User(프로필)는 없고, members.guest_uid로 자기 자리를 가리킨다.
import type { AuthError, PostgrestError, User as AuthUser } from '@supabase/supabase-js'
import { parseInviteCode } from '../domain/inviteCode'
import { expenseAddedTitle } from '../domain/notifications'
import type {
  Category,
  Expense,
  ExpenseInput,
  ExpenseParticipant,
  ExpenseWithParticipants,
  Group,
  GroupDetail,
  Member,
  Notification,
  NotificationType,
  SplitType,
  User,
} from '../domain/types'
import { getSupabase } from '../lib/supabase'
import type { JoinResolution, ProfileInput, SignUpInput, Snapshot } from './index'

/** public.profiles 한 행 (DB는 snake_case) */
interface ProfileRow {
  id: string
  name: string
  bank: string
  account: string
  seen_group_create_coach: boolean
}

const PROFILE_COLUMNS = 'id, name, bank, account, seen_group_create_coach'

/** 프로필(이름·계좌)에 로그인 계정 정보(이메일·인증 여부)를 합쳐 앱의 User로 만든다. */
function toUser(profile: ProfileRow, account: { email: string; emailVerified: boolean }): User {
  return {
    id: profile.id,
    authProvider: 'email',
    email: account.email,
    emailVerified: account.emailVerified,
    name: profile.name,
    bank: profile.bank,
    account: profile.account,
    seenGroupCreateCoach: profile.seen_group_create_coach,
  }
}

/** 내 로그인 계정에서 뽑은 이메일 정보 */
const accountOf = (authUser: AuthUser) => ({
  email: authUser.email ?? '',
  emailVerified: authUser.email_confirmed_at != null,
})

/** Supabase가 주는 영어 에러를 화면에 보여줄 한국어 문구로 바꾼다 (01/02 예외처리). */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      // 미가입 이메일과 비밀번호 불일치를 구분하지 않는다 (계정 존재 여부 노출 방지)
      return '이메일 또는 비밀번호가 일치하지 않아요.'
    case 'user_already_exists':
    case 'email_exists':
      return '이미 가입된 이메일이에요. 로그인해주세요.'
    case 'weak_password':
      return '비밀번호가 너무 짧거나 쉬워요. 더 길게 만들어주세요.'
    case 'email_address_invalid':
    case 'validation_failed':
      return '이메일 형식이 올바르지 않아요'
    case 'anonymous_provider_disabled':
      return '지금은 로그인 없이 참여할 수 없어요. 로그인하거나 가입해주세요.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.'
    default:
      console.error('[supabase auth]', error)
      return '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'
  }
}

async function requireAuthUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  const authUser = data.session?.user
  // 게스트(익명) 세션은 프로필이 없으므로 정식 회원 전용 기능에는 쓸 수 없다
  if (!authUser || authUser.is_anonymous) throw new Error('로그인이 필요해요')
  return authUser.id
}

/** 지금 로그인한 정식 회원. 로그인 안 했거나 게스트(익명)면 null. */
async function loadSessionUser(): Promise<User | null> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  const authUser = data.session?.user
  if (!authUser || authUser.is_anonymous) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', authUser.id)
    .maybeSingle<ProfileRow>()
  if (error) throw new Error(`프로필을 불러오지 못했어요: ${error.message}`)
  // 세션은 남아 있는데 프로필이 없는 경우(탈퇴 직후 등)는 로그아웃 상태로 본다
  return profile ? toUser(profile, accountOf(authUser)) : null
}

// --- 서버 행 → 앱 타입 (DB는 snake_case) ---

interface GroupRow {
  id: string
  name: string
  invite_code: string
}
interface MemberRow {
  id: string
  group_id: string
  user_id: string | null
  guest_uid: string | null
  role: 'owner' | 'member'
  name: string | null
  joined_at: string
}
interface ExpenseRow {
  id: string
  group_id: string
  paid_by: string
  title: string
  amount: number
  category: Category
  receipt_image_url: string | null
  split_type: SplitType
  spent_at: string
  created_at: string
}
interface ParticipantRow {
  expense_id: string
  member_id: string
  share_amount: number | null
}
interface NotificationRow {
  id: string
  group_id: string
  member_id: string | null
  type: NotificationType
  title: string
  created_at: string
  read: boolean
}

const toGroup = (r: GroupRow): Group => ({ id: r.id, name: r.name, inviteCode: r.invite_code })
const toMember = (r: MemberRow): Member => ({
  id: r.id,
  userId: r.user_id,
  groupId: r.group_id,
  role: r.role,
  name: r.name,
  joinedAt: r.joined_at,
})
const toNotification = (r: NotificationRow): Notification => ({
  id: r.id,
  groupId: r.group_id,
  memberId: r.member_id,
  type: r.type,
  title: r.title,
  createdAt: r.created_at,
  read: r.read,
})

const EXPENSE_COLUMNS =
  'id, group_id, paid_by, title, amount, category, receipt_image_url, split_type, spent_at, created_at'
const MEMBER_COLUMNS = 'id, group_id, user_id, guest_uid, role, name, joined_at'

const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  groupId: r.group_id,
  paidBy: r.paid_by,
  title: r.title,
  amount: r.amount,
  category: r.category,
  receiptImageUrl: r.receipt_image_url,
  splitType: r.split_type,
  spentAt: r.spent_at,
  createdAt: r.created_at,
})
const toParticipant = (p: ParticipantRow): ExpenseParticipant => ({
  expenseId: p.expense_id,
  memberId: p.member_id,
  shareAmount: p.share_amount,
})

/** 조회 결과의 error를 던지고, 행 배열로 돌려준다 */
function rowsOrThrow<T>(result: { data: unknown; error: PostgrestError | null }, what: string): T[] {
  if (result.error) throw new Error(`${what}을(를) 불러오지 못했어요: ${result.error.message}`)
  return (result.data ?? []) as T[]
}

// 게스트가 지금 보고 있는 자리 — 익명 세션 하나가 여러 그룹에 들어가 있어도 화면은 "그룹 하나"만 보여준다(conventions.md 게스트 세션 범위).
// 가장 최근에 참여/재입장한 자리를 기억해 두고, 없으면 가장 최근에 만들어진 자리를 쓴다.
const GUEST_MEMBER_KEY = 'nonanae:guest-member'

function readGuestHint(): string | null {
  try {
    return localStorage.getItem(GUEST_MEMBER_KEY)
  } catch {
    return null
  }
}

function writeGuestHint(memberId: string | null): void {
  try {
    if (memberId) localStorage.setItem(GUEST_MEMBER_KEY, memberId)
    else localStorage.removeItem(GUEST_MEMBER_KEY)
  } catch {
    // 저장 못 해도 동작에는 지장 없음(가장 최근 자리로 대체됨)
  }
}

/**
 * 내가 속한 그룹과 그 안의 멤버·지출·알림을 한 번에 읽는다. 어느 행이 보일지는 DB의 RLS가 정한다.
 * - 정식 회원: 내가 멤버인 모든 그룹
 * - 게스트(익명 세션): 지금 보고 있는 자리의 그룹 하나
 */
export async function fetchSnapshot(): Promise<Snapshot> {
  const supabase = getSupabase()
  const empty: Snapshot = { session: { userId: null, viewAsMemberId: null }, users: [], groups: [], notifications: [] }
  const { data: sessionData } = await supabase.auth.getSession()
  const authUser = sessionData.session?.user
  if (!authUser) return empty
  const isGuest = authUser.is_anonymous === true

  const [groupsRes, membersRes, expensesRes, participantsRes, notificationsRes] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code'),
    supabase.from('members').select(MEMBER_COLUMNS).order('joined_at'),
    supabase.from('expenses').select(EXPENSE_COLUMNS).order('created_at'),
    supabase.from('expense_participants').select('expense_id, member_id, share_amount'),
    supabase
      .from('notifications')
      .select('id, group_id, member_id, type, title, created_at, read')
      .order('created_at', { ascending: false }),
  ])
  const allGroups = rowsOrThrow<GroupRow>(groupsRes, '그룹')
  const allMembers = rowsOrThrow<MemberRow>(membersRes, '멤버')
  const allExpenses = rowsOrThrow<ExpenseRow>(expensesRes, '지출')
  const allParticipants = rowsOrThrow<ParticipantRow>(participantsRes, '지출 참여자')
  const allNotifications = rowsOrThrow<NotificationRow>(notificationsRes, '알림')

  let userId: string | null = null
  let viewAsMemberId: string | null = null
  let visibleGroupIds = new Set(allGroups.map((g) => g.id))

  if (isGuest) {
    const mine = allMembers.filter((m) => m.guest_uid === authUser.id)
    const hint = readGuestHint()
    const current =
      mine.find((m) => m.id === hint) ?? [...mine].sort((a, b) => (a.joined_at < b.joined_at ? 1 : -1))[0]
    viewAsMemberId = current?.id ?? null
    visibleGroupIds = new Set(current ? [current.group_id] : [])
  } else {
    userId = authUser.id
  }

  // 멤버가 가리키는 정식 회원들의 프로필(이름·계좌). 내 프로필이 없으면(탈퇴 직후 등) 로그아웃 상태로 본다.
  const members = allMembers.filter((m) => visibleGroupIds.has(m.group_id))
  const profileIds = new Set(members.flatMap((m) => (m.user_id ? [m.user_id] : [])))
  if (userId) profileIds.add(userId)
  const profiles =
    profileIds.size === 0
      ? []
      : rowsOrThrow<ProfileRow>(
          await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', [...profileIds]),
          '프로필',
        )
  if (userId && !profiles.some((p) => p.id === userId)) return empty

  // 다른 사람의 이메일은 화면에서 쓰지 않고 읽을 수도 없으므로 비워 둔다
  const users = profiles.map((p) =>
    toUser(p, p.id === userId ? accountOf(authUser) : { email: '', emailVerified: false }),
  )

  const groups: GroupDetail[] = allGroups
    .filter((g) => visibleGroupIds.has(g.id))
    .map((g) => ({
      ...toGroup(g),
      members: members.filter((m) => m.group_id === g.id).map(toMember),
      expenses: allExpenses
        .filter((e) => e.group_id === g.id)
        .map(
          (e): ExpenseWithParticipants => ({
            ...toExpense(e),
            participants: allParticipants.filter((p) => p.expense_id === e.id).map(toParticipant),
          }),
        ),
    }))

  return {
    session: { userId, viewAsMemberId },
    users,
    groups,
    notifications: allNotifications.filter((n) => visibleGroupIds.has(n.group_id)).map(toNotification),
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(authErrorMessage(error))
  const user = await loadSessionUser()
  if (!user) throw new Error('프로필을 찾지 못했어요')
  return user
}

/**
 * 회원가입 2단계 제출. 이름·은행·계좌는 auth 메타데이터로 함께 보내고,
 * DB 트리거(handle_new_user)가 그 값으로 profiles 행을 만든다.
 */
export async function signUp(input: SignUpInput): Promise<User> {
  const name = input.name.trim()
  const account = input.account.trim()
  if (!name || !input.bank || !account) throw new Error('이름, 은행, 계좌번호를 모두 입력해주세요')

  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name, bank: input.bank, account } },
  })
  if (error) throw new Error(authErrorMessage(error))
  // 이메일 확인이 켜져 있으면 이미 가입된 이메일도 에러 없이 돌아오는데, 그땐 identities가 비어 있다
  if (data.user?.identities?.length === 0) throw new Error('이미 가입된 이메일이에요. 로그인해주세요.')
  // 세션이 없다 = Supabase에서 "이메일 확인"이 켜져 있어 확인 메일을 눌러야 로그인됨
  if (!data.session) throw new Error('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.')

  const user = await loadSessionUser()
  if (!user) throw new Error('프로필을 만들지 못했어요')
  return user
}

export async function signOut(): Promise<void> {
  writeGuestHint(null)
  const { error } = await getSupabase().auth.signOut()
  if (error) throw new Error(authErrorMessage(error))
}

export async function updateProfile(input: ProfileInput): Promise<User> {
  const name = input.name.trim()
  const account = input.account.trim()
  if (!name || !input.bank || !account) throw new Error('이름, 은행, 계좌번호를 모두 입력해주세요')

  const userId = await requireAuthUserId()
  const { error } = await getSupabase()
    .from('profiles')
    .update({ name, bank: input.bank, account })
    .eq('id', userId)
  if (error) throw new Error(`저장하지 못했어요: ${error.message}`)

  const user = await loadSessionUser()
  if (!user) throw new Error('프로필을 찾지 못했어요')
  return user
}

/** 03의 "그룹을 만들고 정산을 시작해요" 안내를 본 것으로 표시(유저당 1회) */
export async function markGroupCreateCoachSeen(): Promise<void> {
  const userId = await requireAuthUserId()
  const { error } = await getSupabase()
    .from('profiles')
    .update({ seen_group_create_coach: true })
    .eq('id', userId)
  if (error) throw new Error(`저장하지 못했어요: ${error.message}`)
}

// --- 05 그룹 생성 ---

/** DB 함수(RPC)가 raise한 영어 메시지를 화면 문구로 바꾼다. 모르는 메시지는 콘솔에만 남기고 일반 문구를 보여준다. */
function rpcErrorMessage(error: PostgrestError): string {
  const message = error.message
  if (message.includes('group name required')) return '그룹 이름을 입력해주세요'
  if (message.includes('guests cannot create groups')) return '로그인한 회원만 그룹을 만들 수 있어요'
  if (message.includes('invalid invite code')) return '존재하지 않는 그룹이에요'
  if (message.includes('member not available')) return '이미 가입된 멤버예요'
  if (message.includes('name required for guests')) return '이름을 입력해주세요'
  if (message.includes('not authenticated')) return '로그인이 필요해요'
  console.error('[supabase rpc]', error)
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'
}

/** 그룹 생성. 그룹과 "내가 방장인 멤버"는 DB 함수(create_group)가 한 번에 만든다. 정식 회원만 가능. */
export async function createGroup(name: string): Promise<Group> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('그룹 이름을 입력해주세요')
  await requireAuthUserId()

  const supabase = getSupabase()
  const { data: groupId, error } = await supabase.rpc('create_group', { p_name: trimmed })
  if (error) throw new Error(rpcErrorMessage(error))

  const { data: row, error: readError } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .single<GroupRow>()
  if (readError) throw new Error(`그룹을 불러오지 못했어요: ${readError.message}`)
  return toGroup(row)
}

// --- 06/07 초대코드로 참여 ---

/** lookup_group_by_code가 돌려주는 값 (참여 전이라 "나 고르기"에 필요한 최소 정보만 있다) */
interface LookupResult {
  id: string
  name: string
  members: { id: string; name: string | null; claimed: boolean }[]
}

// 07의 참여 함수들은 그룹 id만 받는데, DB의 join_group은 초대코드를 요구한다. 06에서 확인한 코드를 그룹별로 기억해 둔다.
// (새로고침하면 06부터 다시 시작하므로 메모리에만 둔다)
const inviteCodeByGroupId = new Map<string, string>()

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 로그인도 게스트 세션도 없으면 익명 로그인을 만든다. 초대코드 조회·참여는 로그인된 세션이 있어야 DB가 받아주기 때문에,
 * "로그인 없이 참여"는 이 익명 세션으로 처리한다.
 */
async function ensureSession(): Promise<AuthUser> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user
  const { data: created, error } = await supabase.auth.signInAnonymously()
  if (error || !created.user) throw new Error(error ? authErrorMessage(error) : '참여를 시작하지 못했어요')
  return created.user
}

/** 내가 이 그룹의 멤버라면 그 멤버 id. (RLS 때문에 멤버가 아니면 행이 아예 안 보인다) */
async function findMyMemberId(groupId: string, authUserId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('members')
    .select('id')
    .eq('group_id', groupId)
    .or(`user_id.eq.${authUserId},guest_uid.eq.${authUserId}`)
    .limit(1)
  if (error) throw new Error(`멤버를 확인하지 못했어요: ${error.message}`)
  return (data as { id: string }[] | null)?.[0]?.id ?? null
}

/** join_group 호출. 정식 회원/게스트에 따라 하는 일은 DB 함수가 나눈다(참여 알림도 거기서 만든다). */
async function joinGroup(code: string, memberId: string | null, name: string | null): Promise<string> {
  const { data, error } = await getSupabase().rpc('join_group', {
    p_code: code,
    p_member_id: memberId,
    p_name: name,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as string
}

/** 게스트가 참여/재입장한 자리를 "지금 보는 자리"로 기억 (fetchSnapshot이 이 그룹만 보여준다) */
function rememberIfGuest(authUser: AuthUser, memberId: string): void {
  if (authUser.is_anonymous) writeGuestHint(memberId)
}

/** 06: 코드 확인. 존재 여부·재입장·개인 초대 링크 여부에 따라 바로 들어가거나 07로 넘긴다. */
export async function resolveInviteCode(raw: string): Promise<JoinResolution> {
  const parsed = parseInviteCode(raw)
  // 개인 초대 링크의 멤버 id는 uuid여야 한다. 아니면 공용 코드로 취급한다
  const targetMemberId = parsed.targetMemberId && UUID_PATTERN.test(parsed.targetMemberId) ? parsed.targetMemberId : null

  const authUser = await ensureSession()
  const { data, error } = await getSupabase().rpc('lookup_group_by_code', { p_code: parsed.code })
  if (error) throw new Error(rpcErrorMessage(error))
  if (!data) return { kind: 'not-found' }
  const group = data as LookupResult
  inviteCodeByGroupId.set(group.id, parsed.code)

  // 이미 이 그룹 멤버(재입장)
  const myMemberId = await findMyMemberId(group.id, authUser.id)
  if (myMemberId) {
    rememberIfGuest(authUser, myMemberId)
    return { kind: 'joined', groupId: group.id, matchedName: null }
  }

  // 개인 초대 링크: 그 자리가 아직 비어 있을 때만 바로 연결. 이미 누가 차지했으면 공용 코드처럼 07로 넘김(06 예외처리)
  const target = targetMemberId ? group.members.find((m) => m.id === targetMemberId && !m.claimed) : undefined
  if (target) {
    const memberId = await joinGroup(parsed.code, target.id, null)
    rememberIfGuest(authUser, memberId)
    return { kind: 'joined', groupId: group.id, matchedName: target.name ?? '' }
  }

  return {
    kind: 'pick',
    groupId: group.id,
    groupName: group.name,
    candidates: group.members.map((m) => ({ id: m.id, name: m.name ?? '', hasAccount: m.claimed })),
  }
}

function requireInviteCode(groupId: string): string {
  const code = inviteCodeByGroupId.get(groupId)
  if (!code) throw new Error('초대코드를 다시 입력해주세요')
  return code
}

/** 07: 목록에서 "이게 나예요". 로그인 상태면 그 자리를 내 계정에 연결(+알림), 게스트면 그 자리를 내 세션에 연결(알림 없음). */
export async function joinAsExistingMember(groupId: string, memberId: string): Promise<void> {
  const authUser = await ensureSession()
  const joinedId = await joinGroup(requireInviteCode(groupId), memberId, null)
  rememberIfGuest(authUser, joinedId)
}

/** 07(로그인 안 함): 목록에 없으면 이름만으로 새로 참여. 계정 없는 멤버(게스트)가 만들어진다. */
export async function joinAsNewGuest(groupId: string, name: string): Promise<Member> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('이름을 입력해주세요')
  const authUser = await ensureSession()
  if (!authUser.is_anonymous) throw new Error('로그인한 상태에서는 이름만으로 참여할 수 없어요')

  const memberId = await joinGroup(requireInviteCode(groupId), null, trimmed)
  rememberIfGuest(authUser, memberId)
  return { id: memberId, userId: null, groupId, role: 'member', name: trimmed, joinedAt: new Date().toISOString() }
}

/** 07(로그인 함): 목록에 없으면 내 계정으로 새 멤버 추가 (이름은 계정 이름 그대로). */
export async function joinAsNewAccountMember(groupId: string): Promise<Member> {
  const userId = await requireAuthUserId()
  const memberId = await joinGroup(requireInviteCode(groupId), null, null)
  return { id: memberId, userId, groupId, role: 'member', name: null, joinedAt: new Date().toISOString() }
}

// --- 08~11 지출 · 12 멤버 추가 · 13 알림 ---

/** 조회·쓰기 실패(PostgREST 에러)를 화면 문구로 바꾼다. 모르는 에러는 콘솔에만 남긴다. */
function dbErrorMessage(error: PostgrestError, foreignKeyMessage = '그룹 멤버가 아닌 사람이 포함돼 있어요'): string {
  if (error.code === '23503') return foreignKeyMessage // 존재하지 않는 그룹/멤버를 가리킴
  if (error.code === '42501') return '이 작업을 할 권한이 없어요' // RLS: 내 그룹이 아님
  console.error('[supabase db]', error)
  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'
}

/**
 * 지출 입력 검증(목업과 같은 규칙) + 결제자·참여자가 모두 이 그룹의 멤버인지 확인.
 * 여러 테이블에 나눠 쓰기 전에 미리 걸러서, 쓰다가 중간에 실패하는 경우를 줄인다.
 */
async function validateExpenseInput(input: ExpenseInput): Promise<void> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('금액은 0보다 큰 정수여야 해요')
  if (!input.title.trim()) throw new Error('항목명을 입력해주세요')
  if (input.participants.length === 0) throw new Error('참여자는 최소 1명이어야 해요')
  const seen = new Set<string>()
  for (const p of input.participants) {
    if (seen.has(p.memberId)) throw new Error('같은 참여자가 두 번 들어갈 수 없어요')
    seen.add(p.memberId)
  }

  const { data, error } = await getSupabase().from('members').select('id').eq('group_id', input.groupId)
  if (error) throw new Error(dbErrorMessage(error))
  const memberIds = new Set(((data ?? []) as { id: string }[]).map((m) => m.id))
  // RLS 때문에 내가 속하지 않은(또는 없는) 그룹은 멤버가 하나도 안 보인다
  if (memberIds.size === 0) throw new Error('존재하지 않는 그룹이에요')
  for (const id of [input.paidBy, ...seen]) {
    if (!memberIds.has(id)) throw new Error('그룹 멤버가 아닌 사람이 포함돼 있어요')
  }
}

const expenseFields = (input: ExpenseInput) => ({
  paid_by: input.paidBy,
  title: input.title.trim(),
  amount: input.amount,
  category: input.category,
  receipt_image_url: input.receiptImageUrl,
  split_type: input.splitType,
  spent_at: input.spentAt,
})

/** expense_participants 행. group_id는 DB가 "같은 그룹의 멤버만" 가리키는지 검사하려고 요구한다(schema.md). */
const participantRows = (expenseId: string, input: ExpenseInput) =>
  input.participants.map((p) => ({
    expense_id: expenseId,
    member_id: p.memberId,
    group_id: input.groupId,
    share_amount: p.shareAmount,
  }))

const withParticipants = (row: ExpenseRow, input: ExpenseInput): ExpenseWithParticipants => ({
  ...toExpense(row),
  participants: input.participants.map((p) => ({ expenseId: row.id, memberId: p.memberId, shareAmount: p.shareAmount })),
})

/** 지출 등록 알림. 앱이 직접 만든다(schema.md). 알림 하나 못 만들었다고 지출 등록을 실패시키지는 않는다. */
async function addExpenseNotification(groupId: string, payerMemberId: string): Promise<void> {
  try {
    const supabase = getSupabase()
    const [groupRes, payerRes] = await Promise.all([
      supabase.from('groups').select('name').eq('id', groupId).single<{ name: string }>(),
      supabase.from('members').select('name, profiles(name)').eq('id', payerMemberId).single(),
    ])
    if (groupRes.error) throw groupRes.error
    if (payerRes.error) throw payerRes.error
    const payer = payerRes.data as unknown as { name: string | null; profiles: { name: string } | { name: string }[] | null }
    const profile = Array.isArray(payer.profiles) ? payer.profiles[0] : payer.profiles
    const { error } = await supabase.from('notifications').insert({
      group_id: groupId,
      member_id: payerMemberId,
      type: 'expense',
      title: expenseAddedTitle(groupRes.data.name, profile?.name ?? payer.name ?? ''),
    })
    if (error) throw error
  } catch (err) {
    console.error('[supabase] 지출 등록 알림을 만들지 못했어요', err)
  }
}

/** 지출 등록. 지출 → 참여자 → 알림 순으로 쓰고, 참여자를 못 넣으면 지출도 되돌려 "참여자 없는 지출"이 남지 않게 한다. */
export async function createExpense(input: ExpenseInput): Promise<ExpenseWithParticipants> {
  await validateExpenseInput(input)
  const supabase = getSupabase()

  const { data: row, error } = await supabase
    .from('expenses')
    .insert({ group_id: input.groupId, ...expenseFields(input) })
    .select(EXPENSE_COLUMNS)
    .single<ExpenseRow>()
  if (error) throw new Error(dbErrorMessage(error))

  const { error: participantsError } = await supabase.from('expense_participants').insert(participantRows(row.id, input))
  if (participantsError) {
    await supabase.from('expenses').delete().eq('id', row.id)
    throw new Error(dbErrorMessage(participantsError))
  }

  await addExpenseNotification(input.groupId, input.paidBy)
  return withParticipants(row, input)
}

/**
 * 지출 수정. 수정은 알림을 만들지 않는다(13 알림1). 소속 그룹은 바꿀 수 없다.
 * 순서: 검증 → 지출 본문 → 참여자 추가·수정(upsert) → 빠진 참여자 삭제.
 * 중간에 실패하면 에러로 끝나 화면의 폼이 그대로 남으므로 다시 저장하면 이어서 맞춰진다.
 */
export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<ExpenseWithParticipants> {
  const supabase = getSupabase()
  const { data: existing, error: findError } = await supabase
    .from('expenses')
    .select('id, group_id')
    .eq('id', expenseId)
    .maybeSingle<{ id: string; group_id: string }>()
  if (findError) throw new Error(dbErrorMessage(findError))
  if (!existing) throw new Error('존재하지 않는 지출이에요')
  if (existing.group_id !== input.groupId) throw new Error('지출의 그룹은 바꿀 수 없어요')
  await validateExpenseInput(input)

  const { data: row, error } = await supabase
    .from('expenses')
    .update(expenseFields(input))
    .eq('id', expenseId)
    .select(EXPENSE_COLUMNS)
    .single<ExpenseRow>()
  if (error) throw new Error(dbErrorMessage(error))

  const { error: upsertError } = await supabase
    .from('expense_participants')
    .upsert(participantRows(expenseId, input), { onConflict: 'expense_id,member_id' })
  if (upsertError) throw new Error(dbErrorMessage(upsertError))

  // 위 검증을 통과한 id는 DB에서 읽은 멤버 uuid뿐이라 필터 문자열에 그대로 넣어도 안전하다
  const kept = input.participants.map((p) => p.memberId).join(',')
  const { error: deleteError } = await supabase
    .from('expense_participants')
    .delete()
    .eq('expense_id', expenseId)
    .not('member_id', 'in', `(${kept})`)
  if (deleteError) throw new Error(dbErrorMessage(deleteError))

  return withParticipants(row, input)
}

/** 지출 삭제. 참여자 행은 DB가 함께 지우고, 이미 만들어진 알림은 그대로 둔다(13 §5). */
export async function deleteExpense(expenseId: string): Promise<void> {
  const { data, error } = await getSupabase().from('expenses').delete().eq('id', expenseId).select('id')
  if (error) throw new Error(dbErrorMessage(error))
  // RLS 때문에 내 그룹의 지출이 아니면 "0건 삭제"로 끝나므로 없는 지출로 본다
  if (!data || data.length === 0) throw new Error('존재하지 않는 지출이에요')
}

/** 앱 미가입 친구를 이름만으로 추가(12). userId는 null이고 알림은 만들지 않는다(13 알림2). */
export async function addPendingMember(groupId: string, name: string): Promise<Member> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('이름을 입력해주세요')
  const { data, error } = await getSupabase()
    .from('members')
    .insert({ group_id: groupId, name: trimmed })
    .select(MEMBER_COLUMNS)
    .single<MemberRow>()
  if (error) throw new Error(dbErrorMessage(error, '존재하지 않는 그룹이에요'))
  return toMember(data)
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await getSupabase().from('notifications').update({ read: true }).eq('id', notificationId)
  if (error) throw new Error(dbErrorMessage(error))
}
