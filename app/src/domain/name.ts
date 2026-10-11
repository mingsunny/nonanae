/**
 * 사람 이름(프로필 이름, 게스트·대기 중 멤버 이름) 길이 한도. 이름은 알림 문구에 그대로 들어가므로 짧게 제한한다.
 * 서버(DB CHECK: profiles_name_len / members_name_len / join_requests_name_len, 20261012000000_name_length_limit.sql)도 같은 한도다.
 */
export const NAME_MAX_LENGTH = 20

export const NAME_TOO_LONG_MESSAGE = `이름은 ${NAME_MAX_LENGTH}자 이하로 입력해주세요.`

/** 앞뒤 공백을 뺀 글자 수(이모지 등은 한 글자로 센다 — DB의 char_length와 같은 기준)가 한도를 넘는지 */
export function isNameTooLong(name: string): boolean {
  return Array.from(name.trim()).length > NAME_MAX_LENGTH
}

/** 한도를 넘으면 에러를 던진다. 비어 있는지는 호출하는 쪽이 따로 본다. */
export function assertNameLength(name: string): void {
  if (isNameTooLong(name)) throw new Error(NAME_TOO_LONG_MESSAGE)
}
