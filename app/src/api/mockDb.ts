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
}

const STORAGE_KEY = 'nonanae:mock-db:v1'

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function isMockDb(value: unknown): value is MockDb {
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
      if (isMockDb(parsed)) return parsed
    }
  } catch {
    // localStorage 접근 불가/파싱 실패 → 시드로 시작
  }
  return createSeed()
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
