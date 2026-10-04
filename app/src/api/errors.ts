/** 이메일 확인이 켜져 있어 가입은 됐지만 메일의 링크를 눌러야 로그인되는 상태. 화면은 에러가 아니라 안내로 보여준다. */
export class SignUpConfirmationRequired extends Error {
  constructor() {
    super('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.')
    this.name = 'SignUpConfirmationRequired'
  }
}
