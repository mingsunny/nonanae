/** 비밀번호 규칙: 8자 이상, 영문과 숫자를 각각 하나 이상. Supabase 대시보드(Auth → Password requirements)에도 같은 규칙을 켜 둔다. */
export const PASSWORD_RULE_HINT = '8자 이상, 영문과 숫자를 섞어주세요'

/** 규칙에 맞지 않으면 화면에 보여줄 문구를, 맞으면 null을 돌려준다. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return '비밀번호는 8자 이상이어야 해요.'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return '비밀번호에 영문과 숫자를 모두 넣어주세요.'
  return null
}
