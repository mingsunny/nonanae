/** 이메일 확인이 켜져 있어 가입은 됐지만 메일의 링크를 눌러야 로그인되는 상태. 화면은 에러가 아니라 안내로 보여준다. */
export class SignUpConfirmationRequired extends Error {
  constructor() {
    super('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.')
    this.name = 'SignUpConfirmationRequired'
  }
}

/** 로그인은 됐지만 이름·계좌(프로필)를 아직 등록하지 않은 계정. 화면은 계좌 등록 화면으로 보낸다. */
export class ProfileIncomplete extends Error {
  constructor() {
    super('이름과 계좌를 등록해주세요')
    this.name = 'ProfileIncomplete'
  }
}
