/** 이메일 확인이 켜져 있어 가입은 됐지만 메일의 링크를 눌러야 로그인되는 상태. 화면은 에러가 아니라 안내로 보여준다. */
export class SignUpConfirmationRequired extends Error {
  constructor() {
    super('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.')
    this.name = 'SignUpConfirmationRequired'
  }
}

/** 비밀번호 변경(04)에서 현재 비밀번호가 틀렸을 때 */
export const CURRENT_PASSWORD_MISMATCH = '현재 비밀번호가 일치하지 않아요.'

/** 지출이 있는 그룹의 통화를 바꾸려 할 때 (목업·서버 공통 문구) */
export const CURRENCY_LOCKED_MESSAGE = '지출이 있는 그룹은 통화를 바꿀 수 없어요'
