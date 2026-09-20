import type { Member, User } from './types'

/**
 * 화면에 표시할 이름. (schema.md "화면에 표시할 이름 결정 순서")
 * userId가 없으면(대기 중 또는 게스트) Member.name, 있으면 정식 회원이므로 User.name.
 */
export function memberDisplayName(member: Member, usersById: Record<string, User>): string {
  if (member.userId === null) return member.name ?? ''
  return usersById[member.userId]?.name ?? member.name ?? ''
}
