// 데이터 접근 계층. 화면/스토어는 이 파일의 함수만 호출한다.
// 지금은 목업 DB(localStorage)를 읽고 쓰지만, 시그니처는 서버 호출과 같은 async로 두었다 —
// Supabase가 붙으면 함수 안쪽만 supabase-js 호출로 바꾸면 되고 호출하는 쪽은 그대로다.
import { memberDisplayName } from '../domain/members'
import type {
  ExpenseInput,
  ExpenseWithParticipants,
  GroupDetail,
  Member,
  Notification,
  User,
} from '../domain/types'
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
    title: `${memberDisplayName(payer, usersById(d)) || '누군가'}님이 [${group.name}]에 내역을 추가했어요`,
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

/** 신규 유저가 그룹에 실제로 참여했을 때의 알림(13 알림2). 참여 흐름(06/07)에서 호출. */
export async function notifyMemberJoined(groupId: string, memberId: string): Promise<void> {
  const d = getDb()
  const group = d.groups.find((g) => g.id === groupId)
  const member = d.members.find((m) => m.id === memberId && m.groupId === groupId)
  if (!group || !member) return // 13 §6: 가리키는 대상을 못 찾으면 알림을 만들지 않음
  d.notifications.push({
    id: uid('n'),
    groupId,
    memberId,
    type: 'member_joined',
    title: `${memberDisplayName(member, usersById(d))}님이 [${group.name}] 그룹에 참여했어요`,
    createdAt: nowIso(),
    read: false,
  })
  commit()
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const d = getDb()
  const n = d.notifications.find((x) => x.id === notificationId)
  if (!n) return
  n.read = true
  commit()
}

/** 개발용: 목업 데이터를 시드 상태로 되돌림 (브라우저 콘솔의 window.__resetMockData()로도 호출 가능) */
export async function resetMockData(): Promise<void> {
  clearStoredDb()
  db = createSeed()
  commit()
}
