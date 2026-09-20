import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { resetMockData } from './api'
import ToastHost from './components/common/Toast'
import { router } from './routes/router'
import { useAppStore } from './store/appStore'

// 개발 중 목업 데이터를 시드 상태로 되돌리는 콘솔 함수: window.__resetMockData() — 로그아웃 상태(인트로부터)로 시작
if (import.meta.env.DEV) {
  ;(window as unknown as { __resetMockData: () => Promise<void> }).__resetMockData = async () => {
    await resetMockData({ signedIn: false })
    window.location.reload()
  }
}

export default function App() {
  const status = useAppStore((s) => s.status)

  useEffect(() => {
    void useAppStore.getState().init()
  }, [])

  // 목업은 즉시 로드되지만, 서버로 바뀌면 이 자리에서 로딩 화면을 보여주게 됨
  if (status !== 'ready') return null

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  )
}
