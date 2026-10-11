// 목업 DB. Supabase 테이블 구조(docs/spec/schema.md)를 그대로 본떠 정규화해 둠.
// 새로고침해도 남도록 localStorage에 저장하고, 없으면(테스트 등) 메모리만 쓴다.
import type { Expense, ExpenseParticipant, Group, Member, Notification, User } from '../domain/types'
import { createSeed } from './mockSeed'

export interface MockSession {
  /** 로그인한 정식 회원. 로그인 안 했으면 null */
  userId: string | null
  /** 로그인 없이 초대코드로 참여한 게스트가 지금 보고 있는 Member.id */
  viewAsMemberId: string | null
}

/** 비밀번호 재설정 요청 1건 (14). 토큰은 1회용이고 expiresAt 이후엔 못 쓴다. */
export interface PasswordReset {
  token: string
  userId: string
  /** ISO 8601 */
  expiresAt: string
  used: boolean
}

/** 참여 요청 1건 (06/07). 방장이 승인하면 지워지고 그때 Member가 생긴다(DB의 join_requests와 같은 모양). */
export interface MockJoinRequest {
  id: string
  groupId: string
  /** 정식 회원이 보낸 요청 */
  userId: string | null
  /** 로그인 없이 보낸 요청: 보낸 브라우저의 게스트 키 (MockDb.guestKey) */
  guestKey: string | null
  /** "이게 나예요"로 고른 자리. 새 멤버로 참여하는 요청이면 null */
  memberId: string | null
  /** 방장에게 보여줄 이름 (요청 시점에 고정) */
  name: string
  /** ISO 8601 */
  createdAt: string
}

export interface MockDb {
  session: MockSession
  users: User[]
  groups: Group[]
  members: Member[]
  expenses: Expense[]
  expenseParticipants: ExpenseParticipant[]
  notifications: Notification[]
  /** userId → 비밀번호. 목업 전용 — 실제로는 Supabase Auth가 해시로 관리하고 프론트는 다루지 않는다. */
  credentials: Record<string, string>
  passwordResets: PasswordReset[]
  joinRequests: MockJoinRequest[]
  /**
   * 이 브라우저의 게스트 키 — Supabase의 익명 세션(auth.uid()) 역할. 로그인 없이 처음 참여를 요청할 때 만들어지고,
   * 방장이 승인하면 guestSeats에 "이 자리 = 이 키"로 남아 게스트가 다시 들어올 때 승인 없이 그 자리로 들어간다.
   */
  guestKey: string | null
  /** Member.id → 그 자리를 차지한 게스트 키 (DB의 members.guest_uid) */
  guestSeats: Record<string, string>
}

const STORAGE_KEY = 'nonanae:mock-db:v1'

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function isMockDb(value: unknown): value is Omit<MockDb, 'joinRequests' | 'guestKey' | 'guestSeats'> {
  const v = value as Partial<MockDb> | null
  return (
    !!v &&
    typeof v.session === 'object' &&
    Array.isArray(v.users) &&
    Array.isArray(v.groups) &&
    Array.isArray(v.members) &&
    Array.isArray(v.expenses) &&
    Array.isArray(v.expenseParticipants) &&
    Array.isArray(v.notifications) &&
    typeof v.credentials === 'object' &&
    v.credentials !== null &&
    Array.isArray(v.passwordResets)
  )
}

export function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      // 승인 기능 이전에 저장된 목업 DB에는 참여 요청 관련 값이 없다 — 빈 값으로 채워 이어 쓴다
      if (isMockDb(parsed)) return { joinRequests: [], guestKey: null, guestSeats: {}, ...parsed }
    }
  } catch {
    // localStorage 접근 불가/파싱 실패 → 시드로 시작
  }
  // 앱을 처음 열면 로그인 전 상태 — 인트로(01)부터 보인다
  return createSeed(Date.now(), { signedIn: false })
}

export function saveDb(db: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // 저장 실패는 무시(메모리 상태로는 계속 동작)
  }
}

export function clearStoredDb(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 무시
  }
}
