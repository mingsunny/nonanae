import { create } from 'zustand'

interface ToastState {
  message: string | null
  /** 같은 문구가 연달아 떠도 애니메이션을 다시 시작하기 위한 키 */
  seq: number
}

export const useToastStore = create<ToastState>()(() => ({ message: null, seq: 0 }))

let timer: ReturnType<typeof setTimeout> | undefined

/** 화면 하단에 잠깐 떴다 사라지는 안내 문구 */
export function showToast(message: string): void {
  clearTimeout(timer)
  useToastStore.setState((s) => ({ message, seq: s.seq + 1 }))
  timer = setTimeout(() => useToastStore.setState({ message: null }), 2000)
}
