// URL 경로의 단일 출처. 표는 docs/spec/conventions.md "URL 경로 (라우팅)" 참고.
// 화면에서 이동할 땐 문자열을 직접 쓰지 말고 이 함수/상수를 쓸 것.
export const paths = {
  welcome: '/welcome',
  login: '/login',
  signup: '/signup',
  signupAccount: '/signup/account',
  groups: '/groups',
  profile: '/profile',
  groupNew: '/groups/new',
  join: '/join',
  passwordReset: '/password-reset',

  group: (groupId: string) => `/groups/${groupId}`,
  groupExpenses: (groupId: string) => `/groups/${groupId}/expenses`,
  groupSettle: (groupId: string) => `/groups/${groupId}/settle`,
  groupSummary: (groupId: string) => `/groups/${groupId}/summary`,
  expenseNew: (groupId: string) => `/groups/${groupId}/expenses/new`,
  expenseEdit: (groupId: string, expenseId: string) =>
    `/groups/${groupId}/expenses/${expenseId}`,
  groupMembers: (groupId: string) => `/groups/${groupId}/members`,
} as const
