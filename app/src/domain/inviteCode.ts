// 초대코드 입력값 해석. 출처: docs/spec/06-join-group.md, 12-group-invite.md §5.
// 코드는 두 가지 형태: 공용 "ABCDEF", 또는 특정 대기 중 멤버를 지정한 개인 초대 "ABCDEF-{Member.id}".

export interface ParsedInviteCode {
  /** 대문자로 정규화한 그룹 초대코드 */
  code: string
  /** 개인 초대 링크면 그 대기 중 멤버의 id, 공용 코드면 null */
  targetMemberId: string | null
}

export function parseInviteCode(raw: string): ParsedInviteCode {
  const value = raw.trim()
  const dash = value.indexOf('-')
  if (dash === -1) return { code: value.toUpperCase(), targetMemberId: null }
  return { code: value.slice(0, dash).toUpperCase(), targetMemberId: value.slice(dash + 1) || null }
}

/** 헷갈리기 쉬운 0/O, 1/I를 뺀 문자로 만드는 6자리 초대코드 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 6

export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]
  return code
}
