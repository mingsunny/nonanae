// 목업 시드 데이터. 프로토타입(settlement-prototype-sep19)의 테스트 계정/그룹/데모 지출을 옮긴 것.
// id는 프로토타입처럼 랜덤이 아니라 읽기 쉬운 고정값 — 테스트와 디버깅이 쉬워짐.
//
// 프로토타입은 "그룹이 하나도 없는 첫 로그인"을 재현하려고 데모 지출을 첫 그룹 생성 시점에 채웠지만,
// 테스트 계정이 이미 데모 그룹의 방장으로 들어 있다. 신규 가입 계정은 그룹이 없는 상태로 시작한다.
// 세션은 옵션으로 고른다: 실제 앱은 처음 열 때 로그아웃 상태(인트로부터)로 시작하고(mockDb.loadDb, __resetMockData),
// 테스트는 기본값인 "테스트 계정으로 로그인된 상태"를 전제로 한다.
import type { Expense, ExpenseParticipant, Group, Member, Notification, User } from '../domain/types'
import { todayIso } from '../lib/format'
import type { MockDb } from './mockDb'

const HOUR = 60 * 60 * 1000

/**
 * 데모 지출의 사용 날짜: 오늘에서 daysAgo일 전('YYYY-MM-DD', 로컬 시간).
 * 고정 날짜로 두면 새 지출(기본 날짜=오늘)이 데모 지출과 다른 날짜 묶음으로 갈라져 목록 순서가 헷갈리므로,
 * 데모는 항상 "오늘 포함 최근 사흘"이 되게 상대 날짜로 만든다.
 */
export function seedDate(daysAgo: number, now: number = Date.now()): string {
  const date = new Date(now)
  date.setDate(date.getDate() - daysAgo)
  return todayIso(date)
}

export interface SeedOptions {
  /** 테스트 계정(u_test)으로 로그인된 상태로 시작할지. 기본값 true — 08~13 테스트가 이 상태를 전제로 한다. */
  signedIn?: boolean
}

export function createSeed(now: number = Date.now(), { signedIn = true }: SeedOptions = {}): MockDb {
  const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString()

  const user = (id: string, email: string, name: string, bank: string, account: string): User => ({
    id,
    authProvider: 'email',
    email,
    emailVerified: true,
    name,
    bank,
    account,
    seenGroupCreateCoach: true,
  })

  const users: User[] = [
    // 로그인 테스트 계정 — a@naver.com / aaaaaaaa
    { ...user('u_test', 'a@naver.com', '테스트', '카카오뱅크', '3333-01-9999999'), seenGroupCreateCoach: false },
    user('u_seyeon', 'seyeon.demo@example.com', '박서연', '카카오뱅크', '3333-01-1234567'),
    user('u_doyoon', 'doyoon.demo@example.com', '김도윤', '국민은행', '123456-04-123456'),
    user('u_hajun', 'hajun.demo@example.com', '이하준', '신한은행', '110-123-456789'),
    user('u_owner', 'owner.demo@example.com', '방장데모', '국민은행', '123-456-789012'),
  ]

  const groups: Group[] = [
    { id: 'g_jeju', name: '제주도 여행', inviteCode: 'JEJU26' },
    // 초대코드 테스트방 — 대기 중 멤버 "김민지"가 있어 "나 고르기" 흐름을 테스트할 수 있음. 테스트 계정은 멤버가 아님.
    { id: 'g_test42', name: '초대코드 테스트방', inviteCode: 'TEST42' },
  ]

  const member = (
    id: string,
    groupId: string,
    userId: string | null,
    role: Member['role'],
    name: string | null,
    offset: number,
  ): Member => ({ id, groupId, userId, role, name, joinedAt: iso(offset) })

  const members: Member[] = [
    member('m_me', 'g_jeju', 'u_test', 'owner', null, -72 * HOUR),
    member('m_seyeon', 'g_jeju', 'u_seyeon', 'member', null, -71 * HOUR),
    member('m_doyoon', 'g_jeju', 'u_doyoon', 'member', null, -70 * HOUR),
    member('m_hajun', 'g_jeju', 'u_hajun', 'member', null, -69 * HOUR),
    member('m_owner42', 'g_test42', 'u_owner', 'owner', null, -24 * HOUR),
    member('m_minji', 'g_test42', null, 'member', '김민지', -23 * HOUR),
  ]

  const all = ['m_me', 'm_seyeon', 'm_doyoon', 'm_hajun']
  const demo: [string, string, number, Expense['category'], string, string[], string][] = [
    // [id, title, amount, category, paidBy, participants, spentAt]
    ['e_1', '애월 게스트하우스 2박', 360000, '숙소', 'm_seyeon', all, seedDate(2, now)],
    ['e_2', '공항 렌터카 3일', 210000, '교통', 'm_doyoon', all, seedDate(2, now)],
    ['e_3', '흑돼지 저녁식사', 128000, '식비', 'm_me', all, seedDate(2, now)],
    ['e_4', '스노클링 체험', 180000, '액티비티', 'm_seyeon', ['m_me', 'm_seyeon', 'm_doyoon'], seedDate(1, now)],
    ['e_5', '오후 카페', 24000, '식비', 'm_hajun', ['m_seyeon', 'm_hajun'], seedDate(1, now)],
    ['e_6', '기념품 쇼핑', 56000, '쇼핑', 'm_me', all, seedDate(0, now)],
  ]

  const expenses: Expense[] = demo.map(([id, title, amount, category, paidBy, , spentAt], i) => ({
    id,
    groupId: 'g_jeju',
    paidBy,
    title,
    amount,
    category,
    receiptImageUrl: null,
    splitType: 'equal',
    spentAt,
    createdAt: iso(-(60 - i) * HOUR),
  }))

  const expenseParticipants: ExpenseParticipant[] = demo.flatMap(([id, , , , , participants]) =>
    participants.map((memberId) => ({ expenseId: id, memberId, shareAmount: null })),
  )

  const notifications: Notification[] = [
    {
      id: 'n_1',
      groupId: 'g_jeju',
      memberId: 'm_hajun',
      type: 'member_joined',
      title: '이하준님이 [제주도 여행] 그룹에 참여했어요',
      createdAt: iso(-69 * HOUR),
      read: true,
    },
    {
      id: 'n_2',
      groupId: 'g_jeju',
      memberId: 'm_me',
      type: 'expense',
      title: '[제주도 여행]에 테스트님이 결제한 내역이 추가됐어요',
      createdAt: iso(-54 * HOUR),
      read: false,
    },
  ]

  return {
    session: { userId: signedIn ? 'u_test' : null, viewAsMemberId: null },
    users,
    groups,
    members,
    expenses,
    expenseParticipants,
    notifications,
    // 데모 유저들은 화면에 이름만 나오면 되므로 로그인 가능한 계정은 테스트 계정 하나뿐
    credentials: { u_test: 'aaaaaaaa' },
    passwordResets: [],
  }
}
