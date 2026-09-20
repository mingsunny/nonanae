import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { showToast } from '../store/toastStore'
import LookupScreen from './join/LookupScreen'
import PickScreen from './join/PickScreen'
import type { PickResolution } from './join/PickScreen'

/**
 * 06 초대코드로 참여 → 07 참여하기(멤버 매칭). 두 화면이 `/join` 한 경로 안의 단계다.
 * 카카오톡 공유 링크(`/join?code=ABCDEF`)나 개인 초대 링크(`/join?code=ABCDEF-{memberId}`)로 들어오면
 * 코드를 채우고 바로 확인한다. 로그인 여부와 무관하게 누구나 들어올 수 있다.
 */
export default function JoinPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const codeFromLink = params.get('code') ?? ''
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const resolveInviteCode = useAppStore((s) => s.resolveInviteCode)

  const [code, setCode] = useState(codeFromLink)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState<PickResolution | null>(null)
  // 개발 모드의 StrictMode는 effect를 두 번 실행하므로, 링크로 들어왔을 때 자동 확인이 두 번(=두 번 참여) 돌지 않게 막음
  const autoRan = useRef(false)

  const enterGroup = useCallback(
    (groupId: string) => navigate(paths.groupExpenses(groupId), { replace: true }),
    [navigate],
  )

  const lookup = useCallback(
    async (raw: string) => {
      setBusy(true)
      try {
        const result = await resolveInviteCode(raw)
        if (result.kind === 'not-found') {
          setNotFound(true)
        } else if (result.kind === 'joined') {
          // 재입장이면 안내 없이 바로 그룹으로, 개인 초대 링크로 그 자리에 연결됐으면 누구로 참여했는지 알려줌 (06 액션 & 결과)
          if (result.matchedName !== null) showToast(`${result.matchedName}님으로 참여했어요`)
          enterGroup(result.groupId)
        } else {
          setPick(result)
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : '코드를 확인하지 못했어요')
      } finally {
        setBusy(false)
      }
    },
    [enterGroup, resolveInviteCode],
  )

  useEffect(() => {
    if (codeFromLink !== '' && !autoRan.current) {
      autoRan.current = true
      void lookup(codeFromLink)
    }
  }, [codeFromLink, lookup])

  if (pick) {
    return <PickScreen pick={pick} onBack={() => setPick(null)} onJoined={enterGroup} />
  }

  return (
    <LookupScreen
      code={code}
      onCodeChange={(next) => {
        setCode(next)
        setNotFound(false)
      }}
      notFound={notFound}
      busy={busy}
      onSubmit={() => lookup(code)}
      // 로그인 상태면 그룹 목록으로, 아니면 인트로로 (06 액션 & 결과)
      onBack={() => navigate(isLoggedIn ? paths.groups : paths.welcome)}
    />
  )
}
