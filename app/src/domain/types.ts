// 엔티티 타입. 출처: docs/spec/schema.md (필드가 바뀌면 그쪽과 함께 수정할 것).
// 서버 전용 필드(User.passwordHash)는 프론트에서 다루지 않으므로 뺐다.
// id는 모두 문자열이며 금액은 원 단위 정수.

export const CATEGORIES = ['숙소', '식비', '교통', '액티비티', '쇼핑', '기타'] as const
export type Category = (typeof CATEGORIES)[number]

export const SPLIT_TYPES = ['equal', 'ratio', 'amount'] as const
export type SplitType = (typeof SPLIT_TYPES)[number]

export type NotificationType = 'expense' | 'member_joined'

/** 이메일로 가입한 정식 회원. 게스트는 User가 아니라 Member로만 존재함. */
export interface User {
  id: string
  authProvider: 'email'
  email: string
  emailVerified: boolean
  name: string
  bank: string | null
  account: string | null
  seenGroupCreateCoach: boolean
}

export interface Group {
  id: string
  name: string
  inviteCode: string
}

/** 정식 회원(userId 있음) / 게스트 / 대기 중(placeholder) 모두 이 타입. 후자 둘은 userId가 null. */
export interface Member {
  id: string
  userId: string | null
  groupId: string
  role: 'owner' | 'member'
  /** userId가 null일 때만 사용하는 표시 이름 */
  name: string | null
  joinedAt: string
}

export interface Expense {
  id: string
  groupId: string
  /** 결제자의 Member.id (User.id 아님) */
  paidBy: string
  title: string
  amount: number
  category: Category
  receiptImageUrl: string | null
  splitType: SplitType
  /** 사용 날짜 'YYYY-MM-DD' */
  spentAt: string
  /** ISO 8601 */
  createdAt: string
}

export interface ExpenseParticipant {
  expenseId: string
  /** 참여자의 Member.id (User.id 아님) */
  memberId: string
  /** equal이면 null(매번 계산), ratio/amount면 등록 시점에 확정된 원 단위 정수 */
  shareAmount: number | null
}

/** 정산 계산이 쓰는 형태: 지출 + 그 지출의 참여자 행들 */
export interface ExpenseWithParticipants extends Expense {
  participants: ExpenseParticipant[]
}

export interface GroupDetail extends Group {
  members: Member[]
  expenses: ExpenseWithParticipants[]
}

export interface Notification {
  id: string
  groupId: string
  /** 이벤트를 일으킨 사람의 Member.id */
  memberId: string | null
  type: NotificationType
  title: string
  /** ISO 8601 */
  createdAt: string
  read: boolean
}

/** memberId → 금액(원) */
export type AmountByMember = Record<string, number>

/** 최소 송금 결과 1건. from/to는 Member.id */
export interface Transfer {
  from: string
  to: string
  amount: number
}
