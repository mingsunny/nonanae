// 목업 시드 데이터. 프로토타입(settlement-prototype-sep19)의 테스트 계정/그룹/데모 지출을 옮긴 것.
// id는 프로토타입처럼 랜덤이 아니라 읽기 쉬운 고정값 — 테스트와 디버깅이 쉬워짐.
//
// 프로토타입은 "그룹이 하나도 없는 첫 로그인"을 재현하려고 데모 지출을 첫 그룹 생성 시점에 채웠지만,
// 08~13 화면을 바로 확인할 수 있도록 여기서는 테스트 계정이 이미 데모 그룹의 방장으로 들어 있고,
// 세션도 그 계정으로 로그인된 상태로 시작한다(개발 중 로그인 화면을 건너뛰려는 것 — 인트로/로그인 화면을
// 보려면 프로필에서 로그아웃하거나 window.__resetMockData() 후 로그아웃). 신규 가입 계정은 그룹이 없는 상태로 시작한다.
import type { Expense, ExpenseParticipant, Group, Member, Notification, User } from '../domain/types'
import type { MockDb } from './mockDb'

const HOUR = 60 * 60 * 1000

export function createSeed(now: number = Date.now()): MockDb {
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
    ['e_1', '애월 게스트하우스 2박', 360000, '숙소', 'm_seyeon', all, '2026-10-12'],
    ['e_2', '공항 렌터카 3일', 210000, '교통', 'm_doyoon', all, '2026-10-12'],
    ['e_3', '흑돼지 저녁식사', 128000, '식비', 'm_me', all, '2026-10-12'],
    ['e_4', '스노클링 체험', 180000, '액티비티', 'm_seyeon', ['m_me', 'm_seyeon', 'm_doyoon'], '2026-10-13'],
    ['e_5', '오후 카페', 24000, '식비', 'm_hajun', ['m_seyeon', 'm_hajun'], '2026-10-13'],
    ['e_6', '기념품 쇼핑', 56000, '쇼핑', 'm_me', all, '2026-10-14'],
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
      title: '테스트님이 [제주도 여행]에 내역을 추가했어요',
      createdAt: iso(-54 * HOUR),
      read: false,
    },
  ]

  return {
    session: { userId: 'u_test', viewAsMemberId: null },
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
