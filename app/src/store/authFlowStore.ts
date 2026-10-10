import { create } from 'zustand'

/**
 * 돌아갈 주소는 이 기기에 하루 동안 남겨 둔다. 가입 확인 메일의 링크는 새 탭으로 열려 메모리 상태가 사라지기 때문.
 * 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 메모리에만 둔다.
 */
const RETURN_TO_KEY = 'nonanae:return-to'
const RETURN_TO_TTL_MS = 24 * 60 * 60 * 1000

function loadReturnTo(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(RETURN_TO_KEY) ?? 'null') as { path: string; at: number } | null
    if (saved && Date.now() - saved.at < RETURN_TO_TTL_MS) return saved.path
  } catch {
    // 무시: 저장된 값이 없거나 읽을 수 없음
  }
  return null
}

function saveReturnTo(path: string | null) {
  try {
    if (path) localStorage.setItem(RETURN_TO_KEY, JSON.stringify({ path, at: Date.now() }))
    else localStorage.removeItem(RETURN_TO_KEY)
  } catch {
    // 무시: 메모리 상태만으로도 같은 탭 안에서는 동작한다
  }
}

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
  returnTo: loadReturnTo(),

  setLoginEmail: (email) => set({ loginEmail: email }),
  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  startSignup: () => set({ draft: { ...emptyDraft, email: get().loginEmail } }),
  setReturnTo: (path) => {
    saveReturnTo(path)
    set({ returnTo: path })
  },
  reset: () => {
    saveReturnTo(null)
    set({ loginEmail: '', draft: emptyDraft, returnTo: null })
  },
}))
