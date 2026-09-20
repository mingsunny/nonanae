// 데이터 접근 계층. 화면/스토어는 이 파일의 함수만 호출한다.
// 지금은 목업 DB(localStorage)를 읽고 쓰지만, 시그니처는 서버 호출과 같은 async로 두었다 —
// Supabase가 붙으면 함수 안쪽만 supabase-js 호출로 바꾸면 되고 호출하는 쪽은 그대로다.
import { generateInviteCode, parseInviteCode } from '../domain/inviteCode'
import { memberDisplayName } from '../domain/members'
import type {
  ExpenseInput,
  ExpenseWithParticipants,
  Group,
  GroupDetail,
  Member,
  Notification,
  User,
} from '../domain/types'
import { paths } from '../routes/paths'
import { clearStoredDb, loadDb, saveDb, uid } from './mockDb'
import type { MockDb, MockSession } from './mockDb'
import { createSeed } from './mockSeed'

let db: MockDb | null = null

function getDb(): MockDb {
  return (db ??= loadDb())
}

function commit(): void {
  saveDb(getDb())
}

const nowIso = () => new Date().toISOString()

/** 화면이 한 번에 그리는 데이터: 내가 속한 그룹들과 관련 유저·알림 */
export interface Snapshot {
  session: MockSession
  users: User[]
  groups: GroupDetail[]
  /** 최신순 */
  notifications: Notification[]
}

/** 내가 속한 그룹만, 그 그룹의 멤버·지출(+참여자)·알림과 멤버가 가리키는 User를 묶어서 반환 */
export async function fetchSnapshot(): Promise<Snapshot> {
  const d = getDb()
  const { userId, viewAsMemberId } = d.session

  const myGroupIds = new Set(
    d.members
      .filter((m) => (userId !== null ? m.userId === userId : m.id === viewAsMemberId))
      .map((m) => m.groupId),
  )

  const groups: GroupDetail[] = d.groups
    .filter((g) => myGroupIds.has(g.id))
    .map((g) => ({
      ...g,
      members: d.members.filter((m) => m.groupId === g.id),
      expenses: d.expenses
        .filter((e) => e.groupId === g.id)
        .map((e) => ({
          ...e,
          participants: d.expenseParticipants.filter((p) => p.expenseId === e.id),
        })),
    }))

  const userIds = new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))
  // 그룹이 하나도 없는 신규 가입자도 자기 정보(이름·계좌)는 읽을 수 있어야 함 (03 인사말, 04 프로필)
  if (userId !== null) userIds.add(userId)
  const users = d.users.filter((u) => userIds.has(u.id))

  const notifications = d.notifications
    .filter((n) => myGroupIds.has(n.groupId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

  return structuredClone({ session: d.session, users, groups, notifications })
}

function usersById(d: MockDb): Record<string, User> {
  return Object.fromEntries(d.users.map((u) => [u.id, u]))
}

function requireGroupMember(d: MockDb, groupId: string, memberId: string): Member {
  const member = d.members.find((m) => m.id === memberId && m.groupId === groupId)
  if (!member) throw new Error(`그룹(${groupId})의 멤버가 아니에요: ${memberId}`)
  return member
}

function validateExpenseInput(d: MockDb, input: ExpenseInput): void {
  if (!d.groups.some((g) => g.id === input.groupId)) throw new Error('존재하지 않는 그룹이에요')
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('금액은 0보다 큰 정수여야 해요')
  if (!input.title.trim()) throw new Error('항목명을 입력해주세요')
  if (input.participants.length === 0) throw new Error('참여자는 최소 1명이어야 해요')
  requireGroupMember(d, input.groupId, input.paidBy)
  const seen = new Set<string>()
  for (const p of input.participants) {
    requireGroupMember(d, input.groupId, p.memberId)
    if (seen.has(p.memberId)) throw new Error('같은 참여자가 두 번 들어갈 수 없어요')
    seen.add(p.memberId)
  }
}

/** 지출 등록. 신규 등록일 때만 그룹에 "내역 추가" 알림을 남긴다(13 알림1, 문구는 생성 시점에 고정). */
export async function createExpense(input: ExpenseInput): Promise<ExpenseWithParticipants> {
  const d = getDb()
  validateExpenseInput(d, input)

  const id = uid('e')
  const { participants, ...fields } = input
  const expense = { ...fields, id, title: input.title.trim(), createdAt: nowIso() }
  d.expenses.push(expense)
  const rows = participants.map((p) => ({ expenseId: id, memberId: p.memberId, shareAmount: p.shareAmount }))
  d.expenseParticipants.push(...rows)

  const group = d.groups.find((g) => g.id === input.groupId)!
  const payer = requireGroupMember(d, input.groupId, input.paidBy)
  d.notifications.push({
    id: uid('n'),
    groupId: group.id,
    memberId: payer.id,
    type: 'expense',
    // 등록한 사람이 아니라 결제자 이름을 쓴다 — 지출에 "등록한 사람" 필드가 없고 다른 사람 대신 등록할 수도 있어서,
    // "OO님이 추가했어요"라고 쓰면 오해를 준다 (13 알림1)
    title: `[${group.name}]에 ${memberDisplayName(payer, usersById(d)) || '누군가'}님이 결제한 내역이 추가됐어요`,
    createdAt: nowIso(),
    read: false,
  })

  commit()
  return structuredClone({ ...expense, participants: rows })
}

/** 지출 수정. 수정은 알림을 만들지 않는다(13 알림1). 소속 그룹은 바꿀 수 없다. */
export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<ExpenseWithParticipants> {
  const d = getDb()
  const existing = d.expenses.find((e) => e.id === expenseId)
  if (!existing) throw new Error('존재하지 않는 지출이에요')
  if (existing.groupId !== input.groupId) throw new Error('지출의 그룹은 바꿀 수 없어요')
  validateExpenseInput(d, input)

  const { participants, ...fields } = input
  Object.assign(existing, fields, { title: input.title.trim() })
  d.expenseParticipants = d.expenseParticipants.filter((p) => p.expenseId !== expenseId)
  const rows = participants.map((p) => ({ expenseId, memberId: p.memberId, shareAmount: p.shareAmount }))
  d.expenseParticipants.push(...rows)

  commit()
  return structuredClone({ ...existing, participants: rows })
}

/** 지출 삭제. 이미 만들어진 알림은 그대로 둔다(13 §5: 알림은 생성 시점에 고정). */
export async function deleteExpense(expenseId: string): Promise<void> {
  const d = getDb()
  if (!d.expenses.some((e) => e.id === expenseId)) throw new Error('존재하지 않는 지출이에요')
  d.expenses = d.expenses.filter((e) => e.id !== expenseId)
  d.expenseParticipants = d.expenseParticipants.filter((p) => p.expenseId !== expenseId)
  commit()
}

/** 앱 미가입 친구를 이름만으로 추가(12). userId는 null. 대기 중 유저 추가는 알림을 만들지 않는다(13 알림2). */
export async function addPendingMember(groupId: string, name: string): Promise<Member> {
  const d = getDb()
  if (!d.groups.some((g) => g.id === groupId)) throw new Error('존재하지 않는 그룹이에요')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('이름을 입력해주세요')

  const member: Member = {
    id: uid('m'),
    userId: null,
    groupId,
    role: 'member',
    name: trimmed,
    joinedAt: nowIso(),
  }
  d.members.push(member)
  commit()
  return structuredClone(member)
}

function addMemberJoinedNotification(d: MockDb, group: Group, member: Member): void {
  d.notifications.push({
    id: uid('n'),
    groupId: group.id,
    memberId: member.id,
    type: 'member_joined',
    title: `${memberDisplayName(member, usersById(d))}님이 [${group.name}] 그룹에 참여했어요`,
    createdAt: nowIso(),
    read: false,
  })
}

/** 신규 유저가 그룹에 실제로 참여했을 때의 알림(13 알림2). 참여 흐름(06/07)에서 호출. */
export async function notifyMemberJoined(groupId: string, memberId: string): Promise<void> {
  const d = getDb()
  const group = d.groups.find((g) => g.id === groupId)
  const member = d.members.find((m) => m.id === memberId && m.groupId === groupId)
  if (!group || !member) return // 13 §6: 가리키는 대상을 못 찾으면 알림을 만들지 않음
  addMemberJoinedNotification(d, group, member)
  commit()
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const d = getDb()
  const n = d.notifications.find((x) => x.id === notificationId)
  if (!n) return
  n.read = true
  commit()
}

// --- 01/02 로그인·회원가입, 04 프로필 ---
// 이메일은 대소문자 구분 없이 다룬다(저장도 소문자). 비밀번호 길이·이메일 형식 정책은 스펙에서 미정이라
// 01 스펙대로 "이메일에 @가 있고 비밀번호가 비어 있지 않은지"만 본다.

const normalizeEmail = (email: string) => email.trim().toLowerCase()

function requireSessionUser(d: MockDb): User {
  const user = d.users.find((u) => u.id === d.session.userId)
  if (!user) throw new Error('로그인이 필요해요')
  return user
}

/** 회원가입 1단계에서 "다음" 누를 때 쓰는 이메일 중복 체크 (2단계 제출 때 signUp이 한 번 더 검사) */
export async function isEmailTaken(email: string): Promise<boolean> {
  return getDb().users.some((u) => u.email === normalizeEmail(email))
}

export async function signIn(email: string, password: string): Promise<User> {
  const d = getDb()
  const user = d.users.find((u) => u.email === normalizeEmail(email))
  // 미가입 이메일과 비밀번호 불일치를 구분하지 않는다 (01 예외처리: 계정 존재 여부 노출 방지)
  if (!user || d.credentials[user.id] !== password) {
    throw new Error('이메일 또는 비밀번호가 일치하지 않아요.')
  }
  d.session = { userId: user.id, viewAsMemberId: null }
  commit()
  return structuredClone(user)
}

export interface SignUpInput {
  email: string
  password: string
  name: string
  bank: string
  account: string
}

/** 회원가입 2단계 제출. 여기서 비로소 User가 만들어지고 바로 로그인 상태가 된다 (02 데이터). */
export async function signUp(input: SignUpInput): Promise<User> {
  const d = getDb()
  const email = normalizeEmail(input.email)
  const name = input.name.trim()
  const account = input.account.trim()
  if (!email.includes('@')) throw new Error('이메일 형식이 올바르지 않아요')
  if (!input.password) throw new Error('비밀번호를 입력해주세요')
  if (!name || !input.bank || !account) throw new Error('이름, 은행, 계좌번호를 모두 입력해주세요')
  if (d.users.some((u) => u.email === email)) throw new Error('이미 가입된 이메일이에요. 로그인해주세요.')

  const user: User = {
    id: uid('u'),
    authProvider: 'email',
    email,
    emailVerified: false,
    name,
    bank: input.bank,
    account,
    seenGroupCreateCoach: false,
  }
  d.users.push(user)
  d.credentials[user.id] = input.password
  d.session = { userId: user.id, viewAsMemberId: null }
  commit()
  return structuredClone(user)
}

/** 로그아웃. 로그인 없이 참여한 게스트가 그룹 화면에서 나갈 때도 똑같이 세션을 비운다. */
export async function signOut(): Promise<void> {
  const d = getDb()
  d.session = { userId: null, viewAsMemberId: null }
  commit()
}

/**
 * 회원 탈퇴. User와 로그인 정보만 지우고, 그 사람의 Member와 지출은 그대로 둔다(04 예외처리 — 정책 미정).
 * 이름은 User에서 조회하므로 다른 멤버 화면에서 그 사람 이름이 빈 값으로 보인다.
 */
export async function deleteAccount(): Promise<void> {
  const d = getDb()
  const user = requireSessionUser(d)
  d.users = d.users.filter((u) => u.id !== user.id)
  delete d.credentials[user.id]
  d.passwordResets = d.passwordResets.filter((r) => r.userId !== user.id)
  d.session = { userId: null, viewAsMemberId: null }
  commit()
}

export interface ProfileInput {
  name: string
  bank: string
  account: string
}

/** 프로필 저장(04). 멤버 화면의 이름/계좌는 매번 User에서 읽으므로 모든 그룹에 바로 반영된다. */
export async function updateProfile(input: ProfileInput): Promise<User> {
  const d = getDb()
  const user = requireSessionUser(d)
  const name = input.name.trim()
  const account = input.account.trim()
  if (!name || !input.bank || !account) throw new Error('이름, 은행, 계좌번호를 모두 입력해주세요')
  Object.assign(user, { name, bank: input.bank, account })
  commit()
  return structuredClone(user)
}

/** 03의 "그룹을 만들고 정산을 시작해요" 안내를 본 것으로 처리(유저당 1회) */
export async function markGroupCreateCoachSeen(): Promise<void> {
  const d = getDb()
  const user = requireSessionUser(d)
  if (user.seenGroupCreateCoach) return
  user.seenGroupCreateCoach = true
  commit()
}

// --- 05 그룹 생성 ---

/** 그룹 생성. 만든 사람은 owner 멤버로 자동 등록되고, 그룹은 빈 상태로 시작한다(05). 정식 회원만 가능. */
export async function createGroup(name: string): Promise<Group> {
  const d = getDb()
  const user = requireSessionUser(d)
  const trimmed = name.trim()
  if (!trimmed) throw new Error('그룹 이름을 입력해주세요')

  let inviteCode = generateInviteCode()
  while (d.groups.some((g) => g.inviteCode === inviteCode)) inviteCode = generateInviteCode()

  const group: Group = { id: uid('g'), name: trimmed, inviteCode }
  d.groups.push(group)
  d.members.push({
    id: uid('m'),
    userId: user.id,
    groupId: group.id,
    role: 'owner',
    name: null,
    joinedAt: nowIso(),
  })
  commit()
  return structuredClone(group)
}

// --- 06/07 초대코드로 참여 ---
// fetchSnapshot은 "내가 속한 그룹"만 돌려주므로, 아직 멤버가 아닌 그룹은 이 함수들로만 다룬다.

/** 07 "나 고르기" 목록의 한 줄. hasAccount가 true면(이미 가입됨) 고를 수 없다. */
export interface JoinCandidate {
  id: string
  name: string
  hasAccount: boolean
}

export type JoinResolution =
  | { kind: 'not-found' }
  /** 이미 그 그룹 멤버(재입장)이거나 개인 초대 링크로 그 자리에 바로 연결됨 → 그룹 안으로. 후자면 matchedName이 채워짐 */
  | { kind: 'joined'; groupId: string; matchedName: string | null }
  /** 공용 코드 → 07 화면에서 본인을 고르거나 새로 참여 */
  | { kind: 'pick'; groupId: string; groupName: string; candidates: JoinCandidate[] }

/** 대기 중 멤버 자리를 실제 계정으로 교체. id는 그대로라 그 자리를 가리키던 지출이 자동으로 이어진다. */
function claimMember(d: MockDb, group: Group, member: Member, userId: string): void {
  member.userId = userId
  member.name = null
  member.joinedAt = nowIso()
  addMemberJoinedNotification(d, group, member)
}

/** 06: 코드 확인. 존재 여부·재입장·개인 초대 링크 여부에 따라 바로 들어가거나 07로 넘긴다. */
export async function resolveInviteCode(raw: string): Promise<JoinResolution> {
  const d = getDb()
  const { code, targetMemberId } = parseInviteCode(raw)
  const group = d.groups.find((g) => g.inviteCode === code)
  if (!group) return { kind: 'not-found' }

  const members = d.members.filter((m) => m.groupId === group.id)
  const { userId, viewAsMemberId } = d.session
  if (members.some((m) => (userId !== null ? m.userId === userId : m.id === viewAsMemberId))) {
    return { kind: 'joined', groupId: group.id, matchedName: null }
  }

  // 개인 초대 링크: 그 자리가 아직 비어 있을 때만 바로 연결. 이미 누가 차지했으면 공용 코드처럼 07로 넘김(06 예외처리)
  const target = targetMemberId ? members.find((m) => m.id === targetMemberId && m.userId === null) : undefined
  if (target) {
    const matchedName = target.name ?? ''
    if (userId !== null) claimMember(d, group, target, userId)
    else d.session.viewAsMemberId = target.id
    commit()
    return { kind: 'joined', groupId: group.id, matchedName }
  }

  const users = usersById(d)
  return {
    kind: 'pick',
    groupId: group.id,
    groupName: group.name,
    candidates: members.map((m) => ({
      id: m.id,
      name: memberDisplayName(m, users),
      hasAccount: m.userId !== null,
    })),
  }
}

/** 07: 목록에서 "이게 나예요". 로그인 상태면 그 자리를 내 계정에 연결(+알림), 아니면 그 자리로 세션만 지정(데이터·알림 변화 없음). */
export async function joinAsExistingMember(groupId: string, memberId: string): Promise<void> {
  const d = getDb()
  const group = d.groups.find((g) => g.id === groupId)
  const member = d.members.find((m) => m.id === memberId && m.groupId === groupId)
  if (!group || !member) throw new Error('존재하지 않는 멤버예요')
  if (member.userId !== null) throw new Error('이미 가입된 멤버예요')

  if (d.session.userId !== null) claimMember(d, group, member, d.session.userId)
  else d.session.viewAsMemberId = member.id
  commit()
}

/** 07(로그인 안 함): 목록에 없으면 이름만으로 새로 참여. 계정 없는 멤버(게스트)가 만들어진다. */
export async function joinAsNewGuest(groupId: string, name: string): Promise<Member> {
  const d = getDb()
  const group = d.groups.find((g) => g.id === groupId)
  if (!group) throw new Error('존재하지 않는 그룹이에요')
  if (d.session.userId !== null) throw new Error('로그인한 상태에서는 이름만으로 참여할 수 없어요')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('이름을 입력해주세요')

  const member: Member = {
    id: uid('m'),
    userId: null,
    groupId,
    role: 'member',
    name: trimmed,
    joinedAt: nowIso(),
  }
  d.members.push(member)
  addMemberJoinedNotification(d, group, member)
  d.session.viewAsMemberId = member.id
  commit()
  return structuredClone(member)
}

/** 07(로그인 함): 목록에 없으면 내 계정으로 새 멤버 추가 (이름은 계정 이름 그대로). */
export async function joinAsNewAccountMember(groupId: string): Promise<Member> {
  const d = getDb()
  const group = d.groups.find((g) => g.id === groupId)
  if (!group) throw new Error('존재하지 않는 그룹이에요')
  const user = requireSessionUser(d)

  const member: Member = {
    id: uid('m'),
    userId: user.id,
    groupId,
    role: 'member',
    name: null,
    joinedAt: nowIso(),
  }
  d.members.push(member)
  addMemberJoinedNotification(d, group, member)
  commit()
  return structuredClone(member)
}

// --- 14 비밀번호 재설정 ---

/** 재설정 링크 유효 시간. 스펙(14)에서 정책 미정이라 흔히 권장하는 30분을 임시로 씀. */
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000

function findValidReset(d: MockDb, token: string) {
  const now = Date.now()
  return d.passwordResets.find((r) => r.token === token && !r.used && new Date(r.expiresAt).getTime() > now)
}

/**
 * 재설정 링크 요청. 가입된 이메일이든 아니든 똑같이 끝난다(14 예외처리: 계정 존재 여부 노출 방지).
 * 메일 발송이 없는 목업이라, 개발 중엔 콘솔에 링크를 찍어 준다.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const d = getDb()
  const user = d.users.find((u) => u.email === normalizeEmail(email))
  if (!user) return

  const token = crypto.randomUUID()
  d.passwordResets.push({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
    used: false,
  })
  commit()
  if (import.meta.env.DEV) {
    const origin = globalThis.location?.origin ?? ''
    console.info(`[목업] 비밀번호 재설정 링크: ${origin}${paths.passwordReset}?token=${token}`)
  }
}

export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  return findValidReset(getDb(), token) !== undefined
}

/** 새 비밀번호 저장. 토큰은 1회용이라 성공하면 그 유저의 모든 재설정 링크가 무효가 된다. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const d = getDb()
  const reset = findValidReset(d, token)
  if (!reset) throw new Error('링크가 만료되었거나 이미 사용됐어요. 재설정 링크를 다시 받아주세요.')
  if (!newPassword) throw new Error('새 비밀번호를 입력해주세요')

  d.credentials[reset.userId] = newPassword
  for (const r of d.passwordResets) if (r.userId === reset.userId) r.used = true
  commit()
}

/**
 * 개발용: 목업 데이터를 시드 상태로 되돌림 (브라우저 콘솔의 window.__resetMockData()로도 호출 가능).
 * 기본값은 테스트 계정으로 로그인된 상태(테스트가 전제), 실제 앱의 리셋은 signedIn: false로 인트로부터 시작한다.
 */
export async function resetMockData({ signedIn = true }: { signedIn?: boolean } = {}): Promise<void> {
  clearStoredDb()
  db = createSeed(Date.now(), { signedIn })
  commit()
}
