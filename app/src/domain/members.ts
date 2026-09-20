import type { Member, User } from './types'

/**
 * 화면에 표시할 이름. (schema.md "화면에 표시할 이름 결정 순서")
 * userId가 없으면(대기 중 또는 게스트) Member.name, 있으면 정식 회원이므로 User.name.
 */
export function memberDisplayName(member: Member, usersById: Record<string, User>): string {
  if (member.userId === null) return member.name ?? ''
  return usersById[member.userId]?.name ?? member.name ?? ''
}

/**
 * 그룹 안에서 "나"에 해당하는 Member. 로그인했으면 userId로, 로그인 없이 초대코드로 참여한 게스트는
 * viewAsMemberId(내가 고른/만든 자리)로 찾는다. 지출 폼의 기본 결제자, "(나)" 표기에 사용.
 */
export function findMyMember(
  members: Member[],
  currentUserId: string | null,
  viewAsMemberId: string | null,
): Member | undefined {
  if (currentUserId !== null) return members.find((m) => m.userId === currentUserId)
  if (viewAsMemberId !== null) return members.find((m) => m.id === viewAsMemberId)
  return undefined
}

/** 송금 받을 계좌. 대기 중 멤버·게스트(userId 없음)는 계좌가 없으므로 null. */
export function memberBankAccount(
  member: Member,
  usersById: Record<string, User>,
): { bank: string; account: string } | null {
  if (member.userId === null) return null
  const user = usersById[member.userId]
  if (!user?.bank || !user.account) return null
  return { bank: user.bank, account: user.account }
}
