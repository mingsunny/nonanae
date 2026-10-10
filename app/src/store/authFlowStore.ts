import { create } from 'zustand'

/** 회원가입 1단계 입력값. 2단계(`/signup/account`)에서 뒤로 돌아와도 남아 있도록 화면 밖에서 들고 있다 (02 진입 경로). */
export interface SignupDraft {
  email: string
  password: string
  passwordConfirm: string
}

const emptyDraft: SignupDraft = { email: '', password: '', passwordConfirm: '' }

interface AuthFlowState {
  /** 로그인 화면에 입력해 둔 이메일. 회원가입으로 넘어갈 때 이어 쓴다 (01 액션 & 결과) */
  loginEmail: string
  draft: SignupDraft
  /** 초대 링크에서 로그인·가입하러 왔을 때, 마치고 돌아갈 주소 (예: `/join?code=ABCDEF`). 없으면 그룹 목록 */
  returnTo: string | null

  setLoginEmail: (email: string) => void
  patchDraft: (patch: Partial<SignupDraft>) => void
  /** 회원가입을 새로 시작: 비밀번호는 비우고, 이메일은 로그인 화면에 입력해 둔 값을 이어서 채운다 */
  startSignup: () => void
  setReturnTo: (path: string | null) => void
  /** 로그인·가입을 마쳤을 때 입력값을 메모리에서 비운다 */
  reset: () => void
}

/** 인트로/로그인/회원가입이 서로 다른 경로라, 화면이 바뀌어도 남아야 하는 입력값만 여기에 둔다. */
export const useAuthFlowStore = create<AuthFlowState>()((set, get) => ({
  loginEmail: '',
  draft: emptyDraft,
  returnTo: null,

  setLoginEmail: (email) => set({ loginEmail: email }),
  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  startSignup: () => set({ draft: { ...emptyDraft, email: get().loginEmail } }),
  setReturnTo: (path) => set({ returnTo: path }),
  reset: () => set({ loginEmail: '', draft: emptyDraft, returnTo: null }),
}))
