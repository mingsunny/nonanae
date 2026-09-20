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

/**
 * 그룹 목록(03) 정렬: 내가 그 그룹에 들어온(만들었거나 참여한) 시각이 최근인 그룹이 위.
 * Group에는 만든 시각이 없어서 내 Member.joinedAt을 기준으로 한다. 같은 시각이면 배열에서 뒤에 있는 그룹이 위.
 */
export function sortGroupsNewestFirst<G extends { members: Member[] }>(
  groups: G[],
  currentUserId: string | null,
  viewAsMemberId: string | null,
): G[] {
  return groups
    .map((group, index) => ({
      group,
      index,
      joinedAt: findMyMember(group.members, currentUserId, viewAsMemberId)?.joinedAt ?? '',
    }))
    .sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : a.joinedAt > b.joinedAt ? -1 : b.index - a.index))
    .map(({ group }) => group)
}
